const MESSAGES = {
  AUTH: {
    LOGIN_SUCCESS: "Login successful! Welcome back.",
    LOGIN_FAILED: "Invalid email or password. Please try again.",
    UNAUTHORIZED: "Please login to continue.",
    REGISTER_SUCCESS: "Account created successfully!",
    REGISTER_FAILED: "Registration failed. Please check your details.",
    LOGOUT_SUCCESS: "Logged out successfully.",
    USER_NOT_FOUND: "User not found",
    BLOCKED: "User is blocked by admin",
    INCORRECT_PASSWORD: "Incorrect password",
    EMAIL_EXISTS: "Email already registered",
    REQUIRED_LOGIN: "Please login",
    BLOCKED_OR_INVALID: "Please login", 
  },
  HOME: {
    LOAD_FAILED: "An error occurred while loading the homepage."
  },
  USER: {
    BLOCKED_SUCCESS: "User blocked successfully",
    UNBLOCKED_SUCCESS: "User unblocked successfully",
    BLOCK_FAILED: "Failed to block user",
    UNBLOCK_FAILED: "Failed to unblock user"
  },
  ADDRESS: {
    LOAD_FAILED: "Failed to load addresses",
    NOT_FOUND: "Address not found",
    ALREADY_EXISTS: "This address already exists in your address book.",
    ADDED_SUCCESS: "Address added successfully",
    UPDATED_SUCCESS: "Address updated successfully",
    DELETED_SUCCESS: "Address deleted successfully",
    INVALID_PHONE: "Phone number must be exactly 10 digits",
    INVALID_PINCODE: "Invalid pincode format",
    INVALID_ID: "Invalid address id"
  },
  SHOP: {
    LOAD_FAILED: "An error occurred while loading the shop.",
    API_LOAD_FAILED: "Failed to load products"
  },
  PRODUCT: {
    NOT_FOUND: "Product not found.",
    OUT_OF_STOCK: "This product is currently out of stock.",
    ADDED_TO_CART: "Product added to cart successfully!",
    ADD_TO_CART_FAILED: "Failed to add product to cart.",
    REMOVED_FROM_CART: "Product removed from cart.",
    CATEGORY_ALREADY_EXISTS: "Category already exists",
    CATEGORY_ADDED_SUCCESS: "Category added successfully",
    OFFER_ADDED_SUCCESS: "Category offer added successfully",
    OFFER_REMOVED_SUCCESS: "Category offer removed successfully",
    LOAD_FAILED: "An error occurred while loading the product page.",
    ADDED_SUCCESS: "Product added successfully",
    UPDATED_SUCCESS: "Product updated successfully",
    BLOCKED_SUCCESS: "Product unlisted successfully",
    UNBLOCKED_SUCCESS: "Product listed successfully",
    BLOCK_FAILED: "Error while unlisting product",
    UNBLOCK_FAILED: "Error while listing product",
    OFFER_ALREADY_APPLIED: "Offer already applied at this percentage",
    ALREADY_EXISTS: "Product already exists, please try with another name",
    INVALID_ID: "Invalid product ID",
    INVALID_CATEGORY: "Invalid category selected",
    IMAGE_REQUIRED: "At least one product image is required",
    MIN_IMAGES_REQUIRED: "At least three product images are required",
    SKIN_TYPE_REQUIRED: "Skin Type is required",
    SKIN_CONCERN_REQUIRED: "Skin Concern is required",
    REQUIRED_FIELDS: "All required fields must be provided",
    INVALID_QUANTITY: "Quantity must be a valid non-negative number",
    OFFER_PERCENT_INVALID: "Offer percentage must be between 1 and 90",
    VERIFY_FAILED: "Failed to verify product in database",
    NO_CATEGORIES: "No categories are available",
    OFFER_ID_REQUIRED: "Product ID is required in the URL parameters",
    OFFER_PERCENT_REQUIRED: "Offer percentage is required in the request body",
    OFFER_PERCENT_TYPE: "Offer percentage must be a number or numeric string",
    OFFER_PERCENT_EMPTY: "Offer percentage cannot be empty",
    OFFER_PERCENT_NAN: "Offer percentage must be a valid numeric value",
    OFFER_PERCENT_WHOLE: "Offer percentage must be a whole number (no decimals)",
    OFFER_PERCENT_RANGE: "Offer percentage must be between 1 and 90 inclusive",
    INVALID_SALE_PRICE: "Product has an invalid sale price. Cannot apply offer"
  },
  CART: {
    LOAD_FAILED: "An error occurred while loading the cart page.",
    NOT_FOUND: "Cart not found",
    ITEM_NOT_FOUND: "Item not in cart",
    INVALID_REQUEST: "Invalid request",
    ADDED_SUCCESS: "Product added to cart!",
    INSUFFICIENT_STOCK: "Insufficient stock",
    MAX_PER_PRODUCT: "Maximum allowed quantity reached",
    MIN_QUANTITY: "Quantity cannot be less than 1"
  },
  PAYMENT: {
    MISSING_DETAILS: "Missing payment details",
    INVALID_SIGNATURE: "Invalid payment signature",
    VERIFICATION_FAILED: "Payment verification failed",
    RETRY_EXPIRED: "Payment retry period has expired",
    RETRY_FAILED: "Failed to retry payment",
    FAILURE_RECORDED: "Payment failure recorded",
    FAILURE_RECORD_FAILED: "Failed to record payment failure"
  },
  ORDER: {
    PLACED_SUCCESS: "Your order has been placed successfully!",
    PLACEMENT_FAILED: "Order failed. Please try again or contact support.",
    PLACED_FAILED: "Failed to place order",
    INVALID_ID: "Invalid Order",
    NOT_FOUND: "Order not found",
    ITEM_NOT_FOUND: "Item not found in order",
    INVALID_STATUS: "Invalid order status",
    STATUS_UPDATED: "Item status updated successfully",
    LOAD_FAILED: "Failed to load orders",
    INVALID_RETURN_REQUEST: "Invalid return request or item status",
    RETURN_ACCEPTED: "Return request accepted and refunded to wallet",
    RETURN_REJECTED: "Return request rejected",
    TRACKING_UPDATE: "Your order status has been updated.",
    TRY_AGAIN: "There was an issue with your transaction. Please try again.",
    COD_LIMIT_EXCEEDED: "Cash on Delivery is only available for orders below ₹1000"
  },
  WALLET: {
    INSUFFICIENT_BALANCE: "Insufficient wallet balance.",
    DEDUCTION_FAILED: "Wallet deduction failed. Please try again.",
    LOAD_FAILED: "Failed to load wallet",
    TOGGLE_SUCCESS: "Wallet settings updated"
  },
  COUPON: {
    INVALID: "Invalid coupon code",
    NOT_ACTIVE_YET: "Coupon not active yet",
    EXPIRED: "Coupon has expired",
    MINIMUM_NOT_MET: "Minimum order amount not met",
    ALREADY_USED: "You have already used this coupon",
    LIMIT_EXCEEDED: "Coupon usage limit reached",
    APPLIED_SUCCESS: "Coupon applied successfully",
    LOAD_FAILED: "An error occurred while loading coupons",
    REASON_ALREADY_USED: "Already used",
    REASON_LIMIT_REACHED: "Usage limit reached",
    REASON_MINIMUM: "Minimum amount required",
    CREATED_SUCCESS: "Coupon created successfully",
    UPDATED_SUCCESS: "Coupon updated successfully",
    DELETED_SUCCESS: "Coupon deleted successfully",
    ACTIVATED: "Coupon activated successfully",
    DEACTIVATED: "Coupon deactivated successfully",
    NOT_FOUND: "Coupon not found",
    ALREADY_EXISTS: "This coupon code already exists",
    CODE_ALREADY_USED: "This coupon code is already used by another coupon"
  },
  OTP: {
    EXPIRED: "OTP has expired",
    INVALID: "Invalid OTP, try again",
    SEND_FAILED: "Failed to send OTP",
    RESENT_SUCCESS: "OTP resent successfully",
    SENT_SUCCESS: "OTP sent successfully",
    MISSING_FIELDS: "Email and OTP are required",
    NOT_FOUND: "OTP not found or expired",
    EMAIL_MISMATCH: "Email does not match the OTP request"
  },
  REFERRAL: {
    LOAD_FAILED: "An error occurred while loading the referral page.",
    NO_CODE: "No referral code provided",
    VALID: "Valid referral code",
    INVALID: "Invalid referral code"
  },
  PROFILE: {
    NAME_REQUIRED: "Name is required",
    INVALID_PHONE: "Invalid phone number format",
    EMAIL_REQUIRED: "Email is required",
    INVALID_EMAIL: "Invalid email format",
    EMAIL_IN_USE: "Email is already in use by another account",
    UPDATED_SUCCESS: "Profile updated successfully",
    EMAIL_UPDATED: "Email updated successfully"
  },
  PASSWORD: {
    REQUIRED_FIELDS: "All fields are required",
    MISMATCH: "Passwords do not match",
    INVALID_FORMAT: "Password must include uppercase, lowercase, number, and special character",
    INCORRECT_CURRENT: "Current password is incorrect",
    UPDATED_SUCCESS: "Password changed successfully"
  },
  SESSION: {
    EMAIL_NOT_FOUND: "Email not found in session"
  },
  WISHLIST: {
    LOAD_FAILED: "Failed to load wishlist",
    INVALID_PRODUCT_ID: "Invalid product ID",
    NOT_FOUND: "Wishlist not found",
    ITEM_NOT_FOUND: "Product not in wishlist",
    ADDED_SUCCESS: "Added to wishlist",
    REMOVED_SUCCESS: "Removed from wishlist",
    CLEARED_SUCCESS: "Wishlist cleared"
  },
  VALIDATION: {
    FIX_ERRORS: "Please fix the following errors",
    REQUIRED_FIELD: "This field is required.",
    INVALID_EMAIL: "Please enter a valid email address.",
    INVALID_INPUT: "Invalid input data.",
    VALIDATION_FAILED: "Validation error occurred.",
    SERVER_ERROR: "Server error during validation.",
    UNKNOWN_ERROR: "An unknown error occurred."
  },
  SALES_REPORT: {
    LOAD_FAILED: "Failed to load sales report.",
    DOWNLOAD_FAILED: "Failed to generate or download the report."
  },
  COMMON: {
    SOMETHING_WENT_WRONG: "Something went wrong. Please try again.",
    INVALID_REQUEST: "Invalid request.",
    INVALID_DATE_RANGE: "Invalid date range selected.",
    LOADING: "Loading...",
    SUCCESS: "Operation completed successfully!",
    ERROR: "An error occurred.",
    NO_DATA: "No data available.",
    CONFIRM_DELETE: "Are you sure you want to delete this?"
  }
};

export default MESSAGES;