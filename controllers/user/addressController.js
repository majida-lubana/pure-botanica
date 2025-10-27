const Address = require("../../models/addressSchema");
const mongoose = require('mongoose')

const addressController = {
 
  loadAddress: async (req, res) => {
    try {
      console.log("[GET /address] Session ID:", req.sessionID);
      console.log("[GET /address] Session:", req.session);

      const userId = req.session.user?.id || req.session.user; 
      console.log("[GET /address] User in session:", userId);

      if (!userId) {
        console.log("[GET /address] No user in session, redirecting to login");
        return res.redirect("/login");
      }

      console.log("[GET /address] User found:", userId);
      const addresses = await Address.find({ userId }).sort({
        isDefault: -1,
        createdAt: -1,
      });
      console.log("[GET /address] Addresses found:", addresses?.length || 0);

      const formattedAddresses = addresses.flatMap((user) =>
        user.address.map((details) => ({
          _id: details._id,
          fullName: details.name, 
          name: details.name,
          phone: details.phone,
          address: details.address, 
          city: details.city,
          state: details.state,
          country: details.country || "India",
          pincode: details.pinCode, 
          pinCode: details.pinCode,
          addressType: details.addressType,
          isDefault: details.isDefault,
          userId: user.userId,
        }))
      );

      res.render("user/address", {
        addresses: formattedAddresses || [],
        error: null,
        errors: {},
        old: {},
        message: null,
      });
    } catch (error) {
      console.error("Load address error:", error);
      res.status(500).render("user/address", {
        addresses: [],
        error: "Failed to load addresses",
        errors: {},
        old: {},
        message: null,
      });
    }
  },

  getAddress: async (req, res) => {
    try {
      console.log("[GET /address/:id] Session ID:", req.sessionID);
      console.log("[GET /address/:id] Session:", req.session);

      const addressId = req.params.id;
      const userId = req.session.user?.id || req.session.user;
      console.log("[GET /address/:id] User in session:", userId);
      console.log("%%%%%%%%%%%%%%%%%%%%%%", addressId);

      if (!userId) {
        console.log("[GET /address/:id] No user in session");
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      console.log("[GET /address/:id] User found:", userId);
      const address = await Address.findOne(
        { userId, "address._id": addressId }, 
        { "address.$": 1 } 
      );
      console.log("[GET /address/:id] Address found:", address);

      if (!address) {
        return res.status(404).json({
          success: false,
          message: "Address not found",
        });
      }

    const details = address.address[0]; 

res.json({
  success: true,
  address: {
    _id: details._id,
    fullName: details.name,
    name: details.name,
    phone: details.phone,
    address: details.address,
    city: details.city,
    state: details.state,
    country: details.country || 'India',
    pincode: details.pinCode,
    pinCode: details.pinCode,
    addressType: details.addressType,
    isDefault: details.isDefault
  }
});

    } catch (error) {
      console.error("Get address error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to load address details",
      });
    }
  },

addAddress: async (req, res) => {
  try {
    console.log("[POST /address/add] Session ID:", req.sessionID);
    console.log("[POST /address/add] Session:", req.session);

    const userId = req.session.user?.id || req.session.user;
    console.log("[POST /address/add] User in session:", userId);

    if (!userId) {
      console.log("[POST /address/add] No user in session");
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    console.log("[POST /address/add] User found:", userId);
    console.log("req.body:", req.body);

    const {
      name: fullName,
      phone,
      address,
      city,
      state,
      country,
      pincode,
      addressType,
      isDefault,
    } = req.body;

    const errors = [];

    if (!fullName?.trim() || fullName.trim().length > 20)
      errors.push("Full name must not exceed 20 characters.");

    if (!phone?.trim() || !/^\d{10}$/.test(phone.trim()))
      errors.push("Phone number must be a valid 10-digit number.");

    if (!address?.trim() || address.trim().length < 5)
      errors.push("Address must be at least 5 characters long.");

    if (!city?.trim() || city.trim().length < 2)
      errors.push("City name must be at least 2 characters.");

    if (!state?.trim()) errors.push("State is required.");

    if (!country?.trim()) errors.push("Country is required.");

    if (!pincode?.trim() || !/^\d{5,6}$/.test(pincode.trim()))
      errors.push("Pincode must be 5 or 6 digits.");

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors,
      });
    }


    let userAddressDoc = await Address.findOne({ userId });
    
    if (userAddressDoc && userAddressDoc.address.length > 0) {
      const isDuplicate = userAddressDoc.address.some((addr) => {
        const normalizeStr = (str) => str?.toString().trim().toLowerCase() || '';
        
        return (
          normalizeStr(addr.address) === normalizeStr(address) &&
          normalizeStr(addr.city) === normalizeStr(city) &&
          normalizeStr(addr.state) === normalizeStr(state) &&
          normalizeStr(addr.pinCode) === normalizeStr(pincode) &&
          normalizeStr(addr.country) === normalizeStr(country)
        );
      });

      if (isDuplicate) {
        return res.status(400).json({
          success: false,
          message: "This address already exists in your address book.",
          isDuplicate: true,
        });
      }
    }

    if (!userAddressDoc) {
      userAddressDoc = new Address({ userId, address: [] });
      await userAddressDoc.save();
    }

    if (isDefault) {
      await Address.updateMany(
        { userId },
        { $set: { "address.$[].isDefault": false } }
      );
    }

    const newAddressObj = {
      name: fullName.trim(),
      phone: phone.trim(),
      city: city.trim(),
      country: country.trim(),
      address: address.trim(),
      state: state.trim(),
      pinCode: pincode.trim(),
      addressType,
      isDefault: Boolean(isDefault),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedDocument = await Address.findOneAndUpdate(
      { userId },
      {
        $push: {
          address: {
            $each: [newAddressObj],
            $position: 0,
          },
        },
      },
      { new: true, upsert: true }
    );

    const addedAddress = updatedDocument.address[0];

    res.json({
      success: true,
      message: "Address added successfully",
      address: {
        _id: addedAddress._id,
        fullName: addedAddress.name,
        name: addedAddress.name,
        phone: addedAddress.phone,
        address: addedAddress.address,
        city: addedAddress.city,
        state: addedAddress.state,
        country: addedAddress.country,
        pincode: addedAddress.pinCode,
        pinCode: addedAddress.pinCode,
        addressType: addedAddress.addressType,
        isDefault: addedAddress.isDefault,
      },
    });
  } catch (error) {
    console.error("Add address error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add address. Please try again.",
    });
  }
},
  
  editAddress: async (req, res) => {
    try {
      console.log("[PUT /address/edit/:id] Session ID:", req.sessionID);
      console.log("[PUT /address/edit/:id] Session:", req.session);

      const addressId = req.params.id;
      const userId = req.session.user?.id || req.session.user;
      console.log("[PUT /address/edit/:id] User in session:", userId);
      console.log("gdgshdhds",addressId)

      if (!userId) {
        console.log("[PUT /address/edit/:id] No user in session");
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      console.log("[PUT /address/edit/:id] User found:", userId);
      console.log("req.body:", req.body);
      const {
        fullName,
        phone,
        address,
        city,
        state,
        country,
        pincode,
        addressType,
        isDefault,
      } = req.body;


      if (
        !fullName ||
        !phone ||
        !address ||
        !city ||
        !state ||
        !country ||
        !pincode ||
        !addressType
      ) {
        return res.status(400).json({
          success: false,
          message: "All fields are required",
        });
      }


      if (!/^\d{10}$/.test(phone)) {
        return res.status(400).json({
          success: false,
          message: "Phone number must be exactly 10 digits",
        });
      }

  
      if (!/^\d{6}$/.test(pincode) || pincode === "000000") {
        return res.status(400).json({
          success: false,
          message: "Invalid pincode format",
        });
      }
      const  objectAddressId = new mongoose.Types.ObjectId(addressId)
      
      const existingAddress = await Address.findOne({userId,'address._id':objectAddressId});
      if (!existingAddress) {
        return res.status(404).json({
          success: false,
          message: "Address not found",
        });
      }

      if (isDefault) {
        await Address.updateMany(
          { userId, 'address.isDefault':true,'address._id':{ $ne: objectAddressId } },
          { $set: { isDefault: false } }
        );
      }

    const updatedAddress = await Address.findOneAndUpdate(
      {userId,'address._id':objectAddressId},
      {
        $set:{
          'address.$.name':fullName.trim(),
          'address.$.phone':phone.trim(),
          'address.$.city':city.trim(),
          'address.$.address':address.trim(),
          'address.$.pinCode':pincode.trim(),
          'address.$.state':state.trim(),
          'address.$.country':country.trim(),
          'address.$.addressType':addressType,
          'address.$.isDefault':Boolean(isDefault),
          'address.$.updatedAt':new Date()
        } 
      },
      {new:true}
    )

    if(!updatedAddress){
      return res.status(404).json({success:false, message: "Address not found" })
    }

    const updatedDetails = updatedAddress.address.find(a=>a._id.equals(objectAddressId))
      res.json({
        success: true,
        message: "Address updated successfully",
        address:{
          id:updatedDetails._id,
          fullName:updatedDetails.name,
          name:updatedDetails.name,
          phone:updatedDetails.phone,
          address:updatedDetails.address,
          city:updatedDetails.city,
          state:updatedDetails.state,
          country:updatedDetails.country||'India',
          pinCode:updatedDetails.pinCode,
          pincode:updatedDetails.pinCode,
          addressType:updatedDetails.addressType,
          isDefault:updatedDetails.isDefault

        }
      });
    } catch (error) {
      console.error("Edit address error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update address. Please try again.",
        address:{
          id:updatedDetails._id,
          fullName:updatedDetails.name,
          name:updatedDetails.name,
          phone:updatedDetails.phone,
          address:updatedDetails.address,
          city:updatedDetails.city,
          state:updatedDetails.state,
          country:updatedDetails.country||'India',
          pinCode:updatedDetails.pinCode,
          pincode:updatedDetails.pinCode,
          addressType:updatedDetails.addressType,
          isDefault:updatedDetails.isDefault

        }
      });
    }
  },


  deleteAddress: async (req, res) => {
    try {
      console.log("[DELETE /address/:id] Session ID:", req.sessionID);
      console.log("[DELETE /address/:id] Session:", req.session);

      const addressId = req.params.id;
      const userId = req.session.user?.id || req.session.user;
      console.log("[DELETE /address/:id] User in session:", userId);

      if (!userId) {
        console.log("[DELETE /address/:id] No user in session");
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      

        if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({ success: false, message: "Invalid address id" });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId)
    const addressObjectId = new mongoose.Types.ObjectId(addressId)



      const updatedDoc = await Address.findOneAndUpdate(
      { userId: userObjectId, 'address._id': addressObjectId },
      { $pull: { address: { _id: addressObjectId } } }, 
      { new: true }
    );
      
      if(!updatedDoc){
        return res.status(404).json({
          success:false,
          message:'Address Not Found'
        })
      }


      res.json({
        success: true,
        message: "Address deleted successfully",
        
      });
    } catch (error) {
      console.error("Delete address error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete address. Please try again.",
      });
    }
  },
};

module.exports = addressController;
