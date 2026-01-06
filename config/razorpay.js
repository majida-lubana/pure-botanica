import Razorpay from 'razorpay';

const {
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET
} = process.env;

let razorpay = null;

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.warn('⚠️ Razorpay disabled: missing key ID or secret');
} else {
  try {
    razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
    console.log('✅ Razorpay initialized successfully');
  } catch (error) {
    console.error('❌ Razorpay initialization failed:', error);
  }
}

export default razorpay;