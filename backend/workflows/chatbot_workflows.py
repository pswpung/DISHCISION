class ChatbotWorkflow():
    @staticmethod
    def validate_action(event:dict) -> dict:
        message = event.get("message").get("text")
        print(f"MESSAGE : {message}")
        if message.lower() == "hi":
            response_content = "Hi Friends, i here to help you!"
        else:
            response_content = f"we don't understand : '{message}'"
        event["message"]["text"] = response_content
        return event