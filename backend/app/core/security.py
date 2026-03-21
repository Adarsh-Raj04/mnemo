from passlib.context import CryptContext
from jose import JWTError, jwt
from cryptography.fernet import Fernet
from datetime import datetime, timedelta, timezone
import os
from dotenv import load_dotenv

load_dotenv()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
fernet = Fernet(os.getenv("ENCRYPTION_KEY").encode())

JWT_SECRET = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINS = int(os.getenv("JWT_EXPIRE_MINUTES", 10080))


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINS)
    return jwt.encode(
        {"sub": user_id, "exp": expire}, JWT_SECRET, algorithm=JWT_ALGORITHM
    )


def decode_access_token(token: str) -> str:
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    return payload.get("sub")


def encrypt_api_key(api_key: str) -> str:
    return fernet.encrypt(api_key.encode()).decode()


def decrypt_api_key(encrypted: str) -> str:
    return fernet.decrypt(encrypted.encode()).decode()
