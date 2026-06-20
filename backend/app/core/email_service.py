from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Configuración de conexión
conf = ConnectionConfig(
    MAIL_USERNAME=settings.SMTP_USER or "",
    MAIL_PASSWORD=settings.SMTP_PASSWORD or "",
    MAIL_FROM=settings.EMAIL_FROM,
    MAIL_PORT=settings.SMTP_PORT,
    MAIL_SERVER=settings.SMTP_HOST,
    MAIL_FROM_NAME=settings.APP_NAME,
    MAIL_TLS=True,
    MAIL_SSL=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
)

async def send_reset_email(email: str, reset_link: str):
    """Envía el correo real de recuperación."""
    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif;">
        <h2 style="color: #2563EB;">Recuperación de Contraseña</h2>
        <p>Hola,</p>
        <p>Has solicitado restablecer tu contraseña en <strong>Delivery360</strong>.</p>
        <p>Haz clic en el botón abaixo para continuar:</p>
        
        <p style="margin: 30px 0;">
          <a href="{reset_link}" style="background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Restablecer Contraseña
          </a>
        </p>
        
        <p>O copia y pega este enlace en tu navegador:</p>
        <p style="word-break: break-all; color: #666;">{reset_link}</p>
        
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999;">
          Este enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.
        </p>
      </body>
    </html>
    """

    message = MessageSchema(
        subject="🔐 Recuperación de Contraseña - Delivery360",
        recipients=[email],
        body=html,
        subtype="html"
    )

    fm = FastMail(conf)
    try:
        await fm.send_message(message)
        logger.info(f"✅ Correo de recuperación enviado exitosamente a {email}")
        return True
    except Exception as e:
        logger.error(f"❌ Error enviando correo a {email}: {str(e)}")
        # En producción, quizás quieras lanzar el error o manejarlo diferente
        return False