from fastapi import APIRouter, Request, HTTPException
import requests
import json
from loguru import logger
from services.line_services import handler
from workflows.chatbot_workflows import ChatbotWorkflow

chatbot = ChatbotWorkflow()
router = APIRouter(
    prefix="/line"
)

@router.post("/callback")
async def callback(request: Request):
    """
    Handles POST requests from the LINE Webhook.
    """
    # 2. Access headers using the Request object
    signature = request.headers.get('X-Line-Signature')
    
    if not signature:
        # A LINE webhook request should always have this header
        raise HTTPException(status_code=400, detail="Missing X-Line-Signature header")

    # 3. Access the raw body asynchronously
    body = await request.body()
    logger.info(f"Original Body : {type(body)}")
    body_str = body.decode("utf-8")
    body_dict = json.loads(body)
    logger.info(f"Request body: {body_dict}")

    # Writing to a file
    with open("data.json", "w") as f:
        json.dump(body_dict, f, indent=4)

    # 4. Handle webhook body
    if body_dict.get("events"):
        event = body_dict.get("events")[0]
        print(f"EVENTS : {event}")
        if not event.get("deliveryContext", {}).get("isRedelivery", True):
            print(f"EVENTS : {event}")
            try:
                # Pass the decoded body and signature to your handler
                # response_content = chatbot.validate_action(event)
                handler.handle(body_str, signature) 
            # except InvalidSignatureError:
            #     logger.info("Invalid signature. Please check your channel access token/channel secret.")
            #     # FastAPI uses HTTPException to return error codes
            #     raise HTTPException(status_code=400, detail="Invalid signature")
            except Exception as e:
                logger.error(f"Error handling LINE message: {e}")
                # Return a server error for unhandled exceptions
                raise HTTPException(status_code=500, detail="Internal server error")
    else:
        logger.info("This not new incoming message!")
    