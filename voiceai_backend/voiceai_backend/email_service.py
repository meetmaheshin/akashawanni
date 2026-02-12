# Email Service for Akashvanni
# Uses Resend HTTP API (HTTPS port 443 — works on Railway)
# Fallback: SMTP if Resend key not set (works locally)
import os
import json
import smtplib
import random
import string
import threading
import urllib.request
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Resend config
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
RESEND_FROM = os.getenv("RESEND_FROM", "Akashvanni <admin@akashvanni.com>")

# SMTP fallback config (for local dev)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.hostinger.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "admin@akashvanni.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Akashvanni")

# Branded email wrapper
BRAND_COLOR = "#4f46e5"
BRAND_COLOR_LIGHT = "#eef2ff"


def _email_wrapper(body_html: str) -> str:
    """Wrap email body in branded template"""
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background-color:#f0f2f5; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5; padding:32px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px; width:100%; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,{BRAND_COLOR} 0%,#7c3aed 100%); padding:32px 40px; text-align:center;">
            <h1 style="margin:0; color:#ffffff; font-size:28px; font-weight:700; letter-spacing:-0.5px;">Akashvanni</h1>
            <p style="margin:6px 0 0; color:rgba(255,255,255,0.85); font-size:13px; letter-spacing:0.5px;">AI Voice Platform</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 32px;">
            {body_html}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 28px; border-top:1px solid #e5e7eb; text-align:center;">
            <p style="margin:0 0 8px; color:#9ca3af; font-size:12px;">Akashvanni &mdash; AI-Powered Voice Calling Platform</p>
            <p style="margin:0; color:#d1d5db; font-size:11px;">TWOZERO &bull; Mayur Vihar Phase-3, East Delhi, 110096</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def generate_verification_code() -> str:
    """Generate a 6-digit verification code"""
    return ''.join(random.choices(string.digits, k=6))


def _send_via_resend(to_email: str, subject: str, html: str):
    """Send email via Resend HTTP API (uses HTTPS, no SMTP ports needed)."""
    payload = json.dumps({
        "from": RESEND_FROM,
        "to": [to_email],
        "subject": subject,
        "html": html
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    resp = urllib.request.urlopen(req, timeout=15)
    result = json.loads(resp.read().decode("utf-8"))
    print(f"✓ Email sent via Resend to {to_email}: {subject} (id={result.get('id', '?')})")
    return result


def _send_via_smtp(to_email: str, subject: str, html: str):
    """Send email via SMTP (for local development)."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_USER}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, to_email, msg.as_string())

    print(f"✓ Email sent via SMTP to {to_email}: {subject}")


def _send_email(to_email: str, subject: str, html: str):
    """Send email — Resend API preferred, SMTP fallback for local dev."""
    try:
        if RESEND_API_KEY:
            _send_via_resend(to_email, subject, html)
        elif SMTP_PASSWORD:
            _send_via_smtp(to_email, subject, html)
        else:
            print("Neither RESEND_API_KEY nor SMTP_PASSWORD set. Email not sent.")
    except Exception as e:
        print(f"✗ Failed to send email to {to_email}: {e}")


def _send_in_background(to_email: str, subject: str, html: str):
    """Fire-and-forget email send"""
    thread = threading.Thread(
        target=_send_email,
        args=(to_email, subject, html),
        daemon=True
    )
    thread.start()


def send_verification_email(to_email: str, code: str, user_name: str):
    """Send branded verification code email"""
    body = f"""
    <p style="margin:0 0 8px; color:#374151; font-size:17px; font-weight:600;">Hi {user_name},</p>
    <p style="margin:0 0 24px; color:#6b7280; font-size:15px; line-height:1.6;">
      Welcome! Please use the verification code below to confirm your email address and activate your account.
    </p>
    <div style="text-align:center; margin:28px 0;">
      <div style="display:inline-block; background:{BRAND_COLOR_LIGHT}; border:2px dashed {BRAND_COLOR}; border-radius:12px; padding:18px 36px;">
        <span style="font-size:40px; font-weight:800; letter-spacing:12px; color:{BRAND_COLOR}; font-family:'Courier New',monospace;">{code}</span>
      </div>
    </div>
    <p style="margin:0 0 8px; color:#6b7280; font-size:14px; text-align:center;">
      This code expires in <strong style="color:#374151;">10 minutes</strong>
    </p>
    <div style="margin:28px 0 0; padding:16px; background:#fef3c7; border-radius:8px; border-left:4px solid #f59e0b;">
      <p style="margin:0; color:#92400e; font-size:13px;">
        If you didn't create an account on Akashvanni, you can safely ignore this email.
      </p>
    </div>
    """
    html = _email_wrapper(body)
    _send_in_background(to_email, f"Verify your email — {code}", html)


def send_welcome_email(to_email: str, user_name: str):
    """Send branded welcome email after verification"""
    body = f"""
    <div style="text-align:center; margin-bottom:24px;">
      <div style="display:inline-block; background:{BRAND_COLOR_LIGHT}; border-radius:50%; padding:16px; margin-bottom:12px;">
        <span style="font-size:36px;">&#127881;</span>
      </div>
      <h2 style="margin:0; color:#111827; font-size:22px; font-weight:700;">Welcome aboard, {user_name}!</h2>
    </div>
    <p style="margin:0 0 20px; color:#6b7280; font-size:15px; line-height:1.7; text-align:center;">
      Your email has been verified and your Akashvanni account is now active. You're all set to start making AI-powered voice calls.
    </p>
    <div style="background:#f9fafb; border-radius:12px; padding:20px; margin:24px 0;">
      <p style="margin:0 0 14px; color:#374151; font-size:14px; font-weight:600;">Here's what you can do:</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 0; color:#6b7280; font-size:14px;">
            <span style="color:{BRAND_COLOR}; font-weight:bold; margin-right:8px;">&#9742;</span>
            <strong style="color:#374151;">Make AI Calls</strong> &mdash; Call any number with your AI assistant
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#6b7280; font-size:14px;">
            <span style="color:{BRAND_COLOR}; font-weight:bold; margin-right:8px;">&#128227;</span>
            <strong style="color:#374151;">Bulk Campaigns</strong> &mdash; Reach hundreds of leads at once
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#6b7280; font-size:14px;">
            <span style="color:{BRAND_COLOR}; font-weight:bold; margin-right:8px;">&#128202;</span>
            <strong style="color:#374151;">Smart Analytics</strong> &mdash; Track hot/cold leads automatically
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#6b7280; font-size:14px;">
            <span style="color:{BRAND_COLOR}; font-weight:bold; margin-right:8px;">&#127759;</span>
            <strong style="color:#374151;">Hindi &amp; English</strong> &mdash; Speak in the language your customers prefer
          </td>
        </tr>
      </table>
    </div>
    <div style="text-align:center; margin:28px 0 8px;">
      <a href="https://akashvanni.com" style="display:inline-block; background:{BRAND_COLOR}; color:#ffffff; font-size:15px; font-weight:600; padding:14px 40px; border-radius:8px; text-decoration:none;">
        Go to Dashboard
      </a>
    </div>
    <p style="margin:20px 0 0; color:#9ca3af; font-size:13px; text-align:center;">
      Need help? Just reply to this email &mdash; we're happy to assist.
    </p>
    """
    html = _email_wrapper(body)
    _send_in_background(to_email, "Welcome to Akashvanni! Your account is ready", html)
