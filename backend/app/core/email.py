import sendgrid
from sendgrid.helpers.mail import Mail
import os
from dotenv import load_dotenv

load_dotenv()

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
SENDGRID_FROM = os.getenv("SENDGRID_FROM_EMAIL")
APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:5173")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")


def send_email(to_email: str, subject: str, html_content: str) -> bool:
    try:
        sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)
        message = Mail(
            from_email=SENDGRID_FROM,
            to_emails=to_email,
            subject=subject,
            html_content=html_content,
        )
        response = sg.send(message)
        print(f"SendGrid status: {response.status_code}")
        return response.status_code in [200, 201, 202]
    except Exception as e:
        print(f"Email error: {e}")
        return False


def send_verification_email(to_email: str, token: str) -> bool:
    verify_link = f"{BACKEND_URL}/auth/verify-email?token={token}"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;">
      <h2 style="color:#3C3489;">Verify your email</h2>
      <p>Thanks for signing up! Click the button below to verify your email address.</p>
      <a href="{verify_link}"
         style="display:inline-block;background:#534AB7;color:#fff;
                padding:12px 28px;border-radius:8px;text-decoration:none;
                font-weight:bold;margin:16px 0;">
        Verify Email
      </a>
      <p style="color:#888;font-size:13px;">
        This link expires in 24 hours. If you did not sign up, ignore this email.
      </p>
      <p style="color:#bbb;font-size:12px;">Or copy this link:<br>{verify_link}</p>
    </div>
    """
    return send_email(to_email, "Verify your Mnemo account", html)


def send_share_invite_email(to_email: str, owner_email: str, permission: str) -> bool:
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;">
      <h2 style="color:#3C3489;">You have been invited!</h2>
      <p><strong>{owner_email}</strong> has shared their Knowledge Base
         with you as a <strong>{permission}</strong>.</p>
      <p>{"You can chat with their documents." if permission == "viewer"
          else "You can upload documents and chat with their knowledge base."}</p>
      <a href="{APP_BASE_URL}"
         style="display:inline-block;background:#534AB7;color:#fff;
                padding:12px 28px;border-radius:8px;text-decoration:none;
                font-weight:bold;margin:16px 0;">
        Open App
      </a>
      <p style="color:#888;font-size:13px;">
        Log in with your account to access the shared knowledge base.
      </p>
    </div>
    """
    return send_email(to_email, f"{owner_email} shared a Knowledge Base with you", html)


def send_password_reset_email(to_email: str, token: str) -> bool:
    reset_link = f"{APP_BASE_URL}/reset-password?token={token}"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;">
      <h2 style="color:#3C3489;">Reset your password</h2>
      <p>We received a request to reset your password. Click below to proceed.</p>
      <a href="{reset_link}"
         style="display:inline-block;background:#534AB7;color:#fff;
                padding:12px 28px;border-radius:8px;text-decoration:none;
                font-weight:bold;margin:16px 0;">
        Reset Password
      </a>
      <p style="color:#888;font-size:13px;">
        This link expires in 1 hour. If you didn't request this, ignore this email.
      </p>
      <p style="color:#bbb;font-size:12px;">Or copy: {reset_link}</p>
    </div>
    """
    return send_email(to_email, "Reset your Mnemo password", html)
