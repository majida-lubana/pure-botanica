const Address = require("../../models/addressSchema");
const mongoose = require('mongoose')

const addressController = {
  // Load address page
  loadAddress: async (req, res) => {
    try {
      console.log("[GET /address] Session ID:", req.sessionID);
      console.log("[GET /address] Session:", req.session);

      const userId = req.session.user?.id || req.session.user; // Handle both formats
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
          fullName: details.name, // Map name to fullName
          name: details.name,
          phone: details.phone,
          address: details.address, // street/address string
          city: details.city,
          state: details.state,
          country: details.country || "India",
          pincode: details.pinCode, // Map pinCode
          pinCode: details.pinCode,
          addressType: details.addressType,
          isDefault: details.isDefault,
          userId: user.userId, // optionally keep top-level userId
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

  // Get single address (for edit modal)
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
        { userId, "address._id": addressId }, // look inside the array
        { "address.$": 1 } // project only the matching address
      );
      console.log("[GET /address/:id] Address found:", address);

      if (!address) {
        return res.status(404).json({
          success: false,
          message: "Address not found",
        });
      }

    const details = address.address[0];  // the matched nested address

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

  // Add new address
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
      name:fullName,
      phone,
      address,
      city,
      state,
      country,
      pincode,
      addressType,
      isDefault,
    } = req.body; 

    
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
      { $push: { address: newAddressObj } },
      { new: true, upsert: true }
    );

    const addedAddress = updatedDocument.address.slice(-1)[0];

   
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

  // Edit address
  editAddress: async (req, res) => {
    try {
      console.log("[PUT /address/edit/:id] Session ID:", req.sessionID);
      console.log("[PUT /address/edit/:id] Session:", req.session);

      const addressId = req.params.id;
      const userId = req.session.user?.id || req.session.user;
      console.log("[PUT /address/edit/:id] User in session:", userId);

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

      // Validate required fields
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

      // Validate phone number format
      if (!/^\d{10}$/.test(phone)) {
        return res.status(400).json({
          success: false,
          message: "Phone number must be exactly 10 digits",
        });
      }

      // Validate pincode format
      if (!/^\d{6}$/.test(pincode) || pincode === "000000") {
        return res.status(400).json({
          success: false,
          message: "Invalid pincode format",
        });
      }
      const  objectAddressId = new mongoose.Types.ObjectId(addressId)
      // Check if address exists and belongs to user
      const existingAddress = await Address.findOne({userId,'address._id':objectAddressId});
      if (!existingAddress) {
        return res.status(404).json({
          success: false,
          message: "Address not found",
        });
      }

      // If this is set as default, remove default from other addresses
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

  // Delete address
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
