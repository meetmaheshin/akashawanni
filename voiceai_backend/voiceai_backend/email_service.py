# Email Service for Akashvanni - Verification Emails
import smtplib
import random
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

SMTP_HOST = "smtp.hostinger.com"
SMTP_PORT = 465
SMTP_EMAIL = "admkn@akashvanni.com"
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", ">AvIvE=|VU1")


def generate_verification_code() -> str:
    """Generate a 6-digit verification code"""
    return ''.join(random.choices(string.digits, k=6))


def send_verification_email(to_email: str, code: str, user_name: str) -> bool:
    """Send verification email with 6-digit code"""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Akashvanni - Verify Your Email ({code})"
        msg["From"] = f"Akashvanni <{SMTP_EMAIL}>"
        msg["To"] = to_email

        html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px;">
          <div style="max-width: 480px; margin: auto; background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #4f46e5; margin: 0;">Akashvanni</h1>
              <p style="color: #6b7280; margin-top: 4px;">AI Voice Platform</p>
            </div>
            <p style="color: #374151; font-size: 16px;">Hi {user_name},</p>
            <p style="color: #374151; font-size: 16px;">Your verification code is:</p>
            <div style="text-align: center; margin: 24px 0;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4f46e5; background: #eef2ff; padding: 12px 24px; border-radius: 8px; display: inline-block;">{code}</span>
            </div>
            <p style="color: #6b7280; font-size: 14px;">This code expires in 10 minutes. If you didn't request this, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">Akashvanni &mdash; AI Voice Platform</p>
          </div>
        </body>
        </html>
        """

        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())

        print(f"✓ Verification email sent to {to_email}")
        return True

    except Exception as e:
        print(f"✗ Failed to send verification email to {to_email}: {e}")
        return False
