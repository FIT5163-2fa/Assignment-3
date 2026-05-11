from fastapi import APIRouter, HTTPException, Request
from pydantic import schema

two_factor_router = APIRouter(tags=["2FA"])


@two_factor_router.post("/create_keypair")
def create_keypair():
    return "Placeholder"
