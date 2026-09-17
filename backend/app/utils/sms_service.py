"""
SMS Service using Twilio
Set environment variables:
  TWILIO_ACCOUNT_SID=your_account_sid
  TWILIO_AUTH_TOKEN=your_auth_token  
  TWILIO_PHONE_NUMBER=+1234567890
  SMS_ENABLED=true
"""
import os
import logging

logger = logging.getLogger(__name__)

SMS_ENABLED = os.getenv("SMS_ENABLED", "false").lower() == "true"
ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
FROM_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")

def send_sms(to_phone: str, message: str) -> bool:
    """Send SMS. Returns True if sent, False if skipped/failed."""
    if not SMS_ENABLED:
        # Log instead of sending (demo mode)
        logger.info(f"[SMS-DEMO] To: {to_phone} | Msg: {message}")
        print(f"[SMS-DEMO] To: {to_phone}")
        print(f"[SMS-DEMO] Message: {message}")
        return True
    
    if not all([ACCOUNT_SID, AUTH_TOKEN, FROM_NUMBER]):
        logger.warning("Twilio credentials not configured. SMS not sent.")
        return False
    
    try:
        from twilio.rest import Client
        client = Client(ACCOUNT_SID, AUTH_TOKEN)
        # Ensure phone has country code
        if not to_phone.startswith('+'):
            to_phone = '+91' + to_phone.lstrip('0')
        msg = client.messages.create(
            body=message,
            from_=FROM_NUMBER,
            to=to_phone
        )
        logger.info(f"SMS sent: {msg.sid}")
        return True
    except Exception as e:
        logger.error(f"SMS failed: {e}")
        return False

# ── Message Templates ──────────────────────────────────────────
def sms_appointment_confirmed(patient_name: str, doctor_name: str, dept: str, time_str: str) -> str:
    return (
        f"SmartQueue Hospital\n"
        f"Hi {patient_name}!\n"
        f"Appointment CONFIRMED\n"
        f"Doctor: {doctor_name}\n"
        f"Dept: {dept}\n"
        f"Time: {time_str}\n"
        f"Please arrive 10 mins early."
    )

def sms_your_turn(patient_name: str, doctor_name: str, room: str = "") -> str:
    return (
        f"SmartQueue Hospital\n"
        f"Hi {patient_name}!\n"
        f"It's YOUR TURN now!\n"
        f"Please proceed to {doctor_name}'s room{' - ' + room if room else ''} immediately.\n"
        f"Thank you!"
    )

def sms_queue_update(patient_name: str, position: int, wait_mins: float) -> str:
    wait = int(wait_mins)
    return (
        f"SmartQueue Hospital\n"
        f"Hi {patient_name}!\n"
        f"Queue Update: Position #{position}\n"
        f"Estimated wait: ~{wait} minutes.\n"
        f"Please be ready!"
    )

def sms_bill_generated(patient_name: str, bill_number: str, amount: float) -> str:
    return (
        f"SmartQueue Hospital\n"
        f"Hi {patient_name}!\n"
        f"Bill Generated: {bill_number}\n"
        f"Total: Rs.{amount:.2f}\n"
        f"Please proceed to billing counter.\n"
        f"Thank you for visiting!"
    )

def sms_appointment_cancelled(patient_name: str, doctor_name: str) -> str:
    return (
        f"SmartQueue Hospital\n"
        f"Hi {patient_name}!\n"
        f"Your appointment with {doctor_name} has been CANCELLED.\n"
        f"Please contact reception or book again.\n"
        f"Sorry for the inconvenience."
    )
