# Razorpay Payment Integration
import razorpay
import os
from typing import Optional
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Razorpay Configuration
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

# Initialize Razorpay client
razorpay_client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
else:
    print("⚠️ Razorpay credentials not configured. Payment features will be disabled.")


class PaymentService:
    """Service for handling Razorpay payments"""
    
    MINIMUM_AMOUNT = 10.0  # Minimum Rs. 10
    
    @staticmethod
    def is_configured() -> bool:
        """Check if Razorpay is configured"""
        return razorpay_client is not None
    
    @staticmethod
    async def create_order(amount: float, user_id: str, receipt_id: Optional[str] = None):
        """Create a Razorpay order for wallet recharge"""
        if not PaymentService.is_configured():
            raise ValueError("Razorpay is not configured")
        
        # Validate minimum amount
        if amount < PaymentService.MINIMUM_AMOUNT:
            raise ValueError(f"Minimum amount is Rs. {PaymentService.MINIMUM_AMOUNT}")
        
        # Convert to paise (Razorpay uses smallest currency unit)
        amount_paise = int(amount * 100)
        
        if not receipt_id:
            # Keep receipt under 40 chars: wr_<last8_of_userid>_<timestamp>
            user_suffix = str(user_id)[-8:]
            timestamp = int(datetime.utcnow().timestamp())
            receipt_id = f"wr_{user_suffix}_{timestamp}"
        
        # Create order
        order_data = {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt_id,
            "notes": {
                "user_id": user_id,
                "purpose": "wallet_recharge"
            }
        }
        
        order = razorpay_client.order.create(data=order_data)
        
        return {
            "order_id": order["id"],
            "amount": amount,
            "amount_paise": amount_paise,
            "currency": order["currency"],
            "receipt": receipt_id
        }
    
    @staticmethod
    def verify_payment_signature(
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str
    ) -> bool:
        """Verify Razorpay payment signature"""
        if not PaymentService.is_configured():
            raise ValueError("Razorpay is not configured")
        
        try:
            params_dict = {
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature
            }
            
            razorpay_client.utility.verify_payment_signature(params_dict)
            return True
        except razorpay.errors.SignatureVerificationError:
            return False
    
    @staticmethod
    async def get_payment_details(payment_id: str):
        """Get payment details from Razorpay"""
        if not PaymentService.is_configured():
            raise ValueError("Razorpay is not configured")
        
        payment = razorpay_client.payment.fetch(payment_id)
        return payment
    
    @staticmethod
    async def get_order_details(order_id: str):
        """Get order details from Razorpay"""
        if not PaymentService.is_configured():
            raise ValueError("Razorpay is not configured")
        
        order = razorpay_client.order.fetch(order_id)
        return order
    
    @staticmethod
    def get_razorpay_key() -> str:
        """Get Razorpay key ID for frontend"""
        if not PaymentService.is_configured():
            raise ValueError("Razorpay is not configured")
        return RAZORPAY_KEY_ID
