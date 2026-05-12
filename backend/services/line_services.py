from linebot.v3 import (
    WebhookHandler
)
from linebot.v3.exceptions import (
    InvalidSignatureError
)
from linebot.v3.messaging import (
    Configuration,
    ApiClient,
    MessagingApi,
    ReplyMessageRequest,
    TextMessage,
    FlexMessage,
    FlexContainer,
    TextMessageV2,
)
from linebot.v3.webhooks import (
    MessageEvent,
    TextMessageContent,
    JoinEvent,
    MemberJoinedEvent
)

configuration = Configuration(
    access_token='ZkP46YTSSZ2rivE8ED0b8wqo8atyoXsvYv9/IpYg0I2BwvTxS8YGm47YbsVcgar6gie0qM6Phklzve6T87ie4d35GdiwPCJxbRZGV9O2H9yj/MIgrxXjXm8unqwcm0U1TFlL+UaFQ48l+RmrVP+zaQdB04t89/1O/w1cDnyilFU=')
handler = WebhookHandler('34398b9931904aeed744e4e39c3d626f')

flex_contents = {
    "type": "bubble",
    "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
            {
                "type": "button",
                "style": "link",
                "action": {
                    "type": "uri",
                    "label": "Create Meeting",
                    "uri": "https://liff.line.me/2008419367-SeVLxzHP"
                }
            }
        ]
    }
}

mention_text = {
    "type": "textV2",
    "text": "{user1} ขอโทษครับ ผมไม่เข้าใจ",
    "substitution": {
        "user1": {
            "type": "mention",
            "mentionee": {
                "type": "user",
                "userId": "Uda21609874de254af4e41885c97e1cf1"
            }
        }
    }
}


def create_flex_message(user_id=None, group_id=None):
    # Base URL using the specific LIFF ID
    # Targeting the /create-meeting page specifically
    LIFF_ID = "2008419367-SeVLxzHP"
    base_liff_url = f"https://liff.line.me/{LIFF_ID}/create-meeting"
    
    # Construct query params
    # NOTE: We include user_id here to designate the "Intended Organizer".
    # The frontend will verify if the logged-in user matches this ID to allow creation.
    # Other users clicking this link will see a "Waiting for Organizer" screen.
    params = []
    if user_id:
        params.append(f"user_id={user_id}")
    if group_id:
        params.append(f"group_id={group_id}")
    
    query_string = "?" + "&".join(params) if params else ""
    dynamic_url = f"{base_liff_url}{query_string}"

    return {
        "type": "bubble",
        "header": {
            "type": "box",
            "layout": "vertical",
            "backgroundColor": "#FFF5EB", # Light Orange Tint
            "paddingAll": "lg",
            "contents": [
                {"type": "text", "text": "🍽️ Let's Eat!", "weight": "bold", "color": "#F58357", "size": "sm"}, # Coral
                {"type": "text", "text": "Plan a Meal", "weight": "bold", "size": "xl", "color": "#2B303B", "wrap": True, "margin": "md"} # Dark Blue-Grey
            ]
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {"type": "text", "text": "Start a new voting session to find the perfect time and place.", "color": "#555555", "size": "sm", "wrap": True}
            ]
        },
        "footer": {
            "type": "box",
            "layout": "vertical",
            "spacing": "sm",
            "contents": [
                {
                    "type": "button",
                    "style": "primary",
                    "height": "sm",
                    "color": "#F58357", # Coral
                    "action": {
                        "type": "uri",
                        "label": "Create Meeting",
                        "uri": dynamic_url
                    }
                }
            ],
            "flex": 0
        }
    }

# --- PUSH MESSAGES ---
from linebot.v3.messaging import PushMessageRequest

def push_message_creation_flex(group_id: str, meeting_id: str, meeting_name: str, meal_time: str, start_date: str = "", end_date: str = ""):
    if not group_id:
        return

    # Link: /vote?group_id=...&meeting_id=...
    LIFF_ID = "2008419367-SeVLxzHP"
    params = []
    if group_id:
        params.append(f"group_id={group_id}")
    if meeting_id:
        params.append(f"meeting_id={meeting_id}")

    query_string = "?" + "&".join(params) if params else ""
    vote_url = f"https://liff.line.me/{LIFF_ID}/vote{query_string}"
    print(f"Vote URL: {vote_url}")
    
    # Format Period String
    period_str = "Not specified"
    if start_date and end_date:
        period_str = f"{start_date} - {end_date}"
    elif start_date:
        period_str = start_date

    flex = {
        "type": "bubble",
        "header": {
            "type": "box",
            "layout": "vertical",
            "backgroundColor": "#FFF5EB", # Light Orange Tint
            "paddingAll": "lg",
            "contents": [
                {"type": "text", "text": "📅 New Meeting Created!", "weight": "bold", "color": "#F58357", "size": "sm"}, # Coral
                {"type": "text", "text": meeting_name, "weight": "bold", "size": "xl", "color": "#2B303B", "wrap": True, "margin": "md"} # Dark Blue-Grey
            ]
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {
                    "type": "box",
                    "layout": "vertical",
                    "margin": "lg",
                    "spacing": "sm",
                    "contents": [
                        {
                            "type": "box",
                            "layout": "baseline",
                            "spacing": "sm",
                            "contents": [
                                {"type": "text", "text": "Period", "color": "#aaaaaa", "size": "sm", "flex": 2},
                                {"type": "text", "text": period_str, "wrap": True, "color": "#2B303B", "size": "sm", "flex": 4}
                            ]
                        },
                         {
                            "type": "box",
                            "layout": "baseline",
                            "spacing": "sm",
                            "contents": [
                                {"type": "text", "text": "Time", "color": "#aaaaaa", "size": "sm", "flex": 2},
                                {"type": "text", "text": meal_time, "wrap": True, "color": "#2B303B", "size": "sm", "flex": 4}
                            ]
                        }
                    ]
                }
            ]
        },
        "footer": {
            "type": "box",
            "layout": "vertical",
            "spacing": "sm",
            "contents": [
                {
                    "type": "button",
                    "style": "primary",
                    "height": "sm",
                    "color": "#F58357", # Coral
                    "action": {
                        "type": "uri",
                        "label": "Vote Now",
                        "uri": vote_url
                    }
                }
            ],
            "flex": 0
        }
    }

    try:
        with ApiClient(configuration) as api_client:
            line_bot_api = MessagingApi(api_client)
            line_bot_api.push_message(
                PushMessageRequest(
                    to=group_id,
                    messages=[FlexMessage(alt_text=f"New Meeting: {meeting_name}", contents=FlexContainer.from_dict(flex))]
                )
            )
            print(f"Pushed Creation Flex to {group_id}")
    except Exception as e:
        print(f"Error pushing creation message: {e}")

def push_message_result_flex(group_id: str, meeting_id: str, meeting_name: str, top_slots: list, preferred_restaurants: list = None, all_scored_restaurants: list = None, meal_time: str = "", start_date: str = "", end_date: str = ""):
    # if not group_id or not top_slots:
    if not group_id:
        return

    # Link: /result?group_id=...&meeting_id=...
    LIFF_ID = "2008419367-SeVLxzHP"
    # Base Params
    base_params = []
    if group_id:
        base_params.append(f"group_id={group_id}")
    if meeting_id:
        base_params.append(f"meeting_id={meeting_id}")
    
    # Create Summary Bubble
    summary_items = []
    for i, slot in enumerate(top_slots): # Show top 5 in summary
        date_str = slot['date']
        time_str = slot['time']
        score = slot['final_score']
        score_color = "#FFD700" if score >= 8 else "#F58357" if score >= 5 else "#666666"
        
        summary_items.append({
            "type": "box",
            "layout": "baseline",
            "contents": [
                {"type": "text", "text": f"{i+1}.", "size": "sm", "color": "#2B303B", "flex": 1, "weight": "bold"},
                {"type": "text", "text": f"{date_str} {time_str}", "size": "sm", "color": "#555555", "flex": 6, "wrap": True},
                {"type": "text", "text": f"{score:.1f}", "size": "sm", "color": score_color, "flex": 2, "align": "end", "weight": "bold"}
            ],
            "margin": "sm"
        })

    base_query_string = "?" + "&".join(base_params) if base_params else ""
    base_result_url = f"https://liff.line.me/{LIFF_ID}/result{base_query_string}"

    # 0. Meeting Summary Bubble (Hero)
    period_str = "Not specified"
    if start_date and end_date:
        period_str = f"{start_date} - {end_date}"
    elif start_date:
        period_str = start_date

    meeting_summary_bubble = {
        "type": "bubble",
        "size": "kilo",
        "header": {
            "type": "box",
            "layout": "vertical",
            "backgroundColor": "#FFF5EB", # Light Orange Tint
            "paddingAll": "lg",
            "contents": [
                {"type": "text", "text": "🏁 Voting Results", "weight": "bold", "color": "#F58357", "size": "sm"},
                {"type": "text", "text": meeting_name, "weight": "bold", "size": "xl", "color": "#2B303B", "wrap": True, "margin": "md"}
            ]
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {
                    "type": "box",
                    "layout": "vertical",
                    "margin": "md",
                    "spacing": "sm",
                    "contents": [
                        {
                            "type": "box",
                            "layout": "baseline",
                            "spacing": "sm",
                            "contents": [
                                {"type": "text", "text": "Period", "color": "#aaaaaa", "size": "sm", "flex": 2},
                                {"type": "text", "text": period_str, "wrap": True, "color": "#2B303B", "size": "sm", "flex": 4}
                            ]
                        },
                         {
                            "type": "box",
                            "layout": "baseline",
                            "spacing": "sm",
                            "contents": [
                                {"type": "text", "text": "Time", "color": "#aaaaaa", "size": "sm", "flex": 2},
                                {"type": "text", "text": meal_time, "wrap": True, "color": "#2B303B", "size": "sm", "flex": 4}
                            ]
                        }
                    ]
                }
            ]
        },
        "footer": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {
                    "type": "button",
                    "style": "primary",
                    "height": "sm",
                    "color": "#F58357",
                    "action": {
                        "type": "uri",
                        "label": "Open Results Page",
                        "uri": base_result_url
                    }
                }
            ]
        }
    }

    # 1. Top Results Summary Bubble
    summary_bubble = {
        "type": "bubble",
        "size": "kilo",
        "header": {
            "type": "box",
            "layout": "vertical",
            "backgroundColor": "#F58357", # Primary Color
            "paddingAll": "lg",
            "contents": [
                {"type": "text", "text": "🏆 Top Time Slots", "weight": "bold", "size": "lg", "color": "#FFFFFF"},
            ]
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "paddingAll": "md",
            "spacing": "xs",
            "contents": [
                {"type": "text", "text": "Best times for your group:", "size": "xs", "color": "#aaaaaa", "margin": "none"},
                {"type": "separator", "margin": "md", "color": "#dddddd"},
                *summary_items
            ]
        },
        "footer": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {
                    "type": "button",
                    "style": "secondary",
                    "height": "sm",
                    "color": "#F58357",
                    "action": {
                        "type": "uri",
                        "label": "See All Results",
                        "uri": base_result_url
                    }
                }
            ]
        }
    }

    bubbles = [meeting_summary_bubble, summary_bubble]

    # Add Preferred Restaurants Bubble if available
    if preferred_restaurants:
        pref_items = []
        for i, r in enumerate(preferred_restaurants[:10]):
            pref_items.append({
                "type": "box",
                "layout": "baseline",
                "contents": [
                    {"type": "text", "text": f"{i+1}.", "size": "sm", "color": "#2B303B", "flex": 1, "weight": "bold"},
                    {"type": "text", "text": r.get('name', 'N/A'), "size": "sm", "color": "#555555", "flex": 8, "wrap": True},
                ],
                "margin": "sm"
            })
        
        preferred_bubble = {
            "type": "bubble",
            "size": "kilo",
            "header": {
                "type": "box",
                "layout": "vertical",
                "backgroundColor": "#F58357", # Orange/Coral
                "paddingAll": "lg",
                "contents": [
                    {"type": "text", "text": "🙋 Group Favorites", "weight": "bold", "size": "lg", "color": "#FFFFFF"},
                ]
            },
            "body": {
                "type": "box",
                "layout": "vertical",
                "paddingAll": "md",
                "contents": [
                    {"type": "text", "text": "Explicitly suggested by attendees:", "size": "xs", "color": "#aaaaaa"},
                    {"type": "separator", "margin": "md"},
                    *pref_items
                ]
            },
            "footer": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "button",
                        "style": "secondary",
                        "height": "sm",
                        "color": "#F58357",
                        "action": {
                            "type": "uri",
                            "label": "View Details",
                            "uri": base_result_url
                        }
                    }
                ]
            }
        }
        bubbles.append(preferred_bubble)
    
    # Bubble for Global Discovery Ranking
    if all_scored_restaurants:
        discovery_items = []
        for i, r in enumerate(all_scored_restaurants[:10]):
            discovery_items.append({
                "type": "box",
                "layout": "baseline",
                "contents": [
                    {"type": "text", "text": f"{i+1}.", "size": "sm", "color": "#2B303B", "flex": 1, "weight": "bold"},
                    {"type": "text", "text": r.get('name', 'N/A'), "size": "sm", "color": "#555555", "flex": 6, "wrap": True},
                    {"type": "text", "text": f"{r.get('score', 0):.1f}", "size": "sm", "color": "#F58357", "flex": 2, "align": "end", "weight": "bold"}
                ],
                "margin": "sm"
            })
        
        discovery_bubble = {
            "type": "bubble",
            "size": "kilo",
            "header": {
                "type": "box",
                "layout": "vertical",
                "backgroundColor": "#F58357", # Orange/Coral
                "paddingAll": "lg",
                "contents": [
                    {"type": "text", "text": "🔍 Discovery Ranking", "weight": "bold", "size": "lg", "color": "#FFFFFF"},
                ]
            },
            "body": {
                "type": "box",
                "layout": "vertical",
                "paddingAll": "md",
                "contents": [
                    {"type": "text", "text": "Top recommendations for your group:", "size": "xs", "color": "#aaaaaa"},
                    {"type": "separator", "margin": "md"},
                    *discovery_items
                ]
            },
            "footer": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "button",
                        "style": "secondary",
                        "height": "sm",
                        "color": "#F58357",
                        "action": {
                            "type": "uri",
                            "label": "Explore All",
                            "uri": base_result_url
                        }
                    }
                ]
            }
        }
        bubbles.append(discovery_bubble)
    for slot in top_slots[:5]:
        date_str = slot['date']
        time_str = slot['time']
        score = slot['final_score']
        
        # Link: /result?group_id=...&meeting_id=...&date=...&time=...
        # We need to construct URL for THIS specific slot
        slot_params = base_params.copy()
        slot_params.append(f"date={date_str}")
        slot_params.append(f"time={time_str}")
        
        query_string = "?" + "&".join(slot_params)
        result_url = f"https://liff.line.me/{LIFF_ID}/result{query_string}"
        print(f"Result URL for {date_str} {time_str}: {result_url}")

        attendees = slot.get('attendees', [])
        restaurants = slot.get('restaurants', [])
        top_restaurant_name = restaurants[0].get('name') if restaurants else "No Suggestion"

        # Format Attendees List
        # Maybe show first 3 and "+ X more" to save space, or just comma separated
        attendees_str = ", ".join(attendees)
        if not attendees_str:
            attendees_str = "None"
        
        # Color coding for score
        score_color = "#FFD700" if score >= 8 else "#F58357" if score >= 5 else "#666666"

        bubble = {
            "type": "bubble",
            "size": "kilo", # slightly larger
            "header": {
                "type": "box",
                "layout": "vertical",
                "backgroundColor": "#FFF5EB", # Light Orange Tint
                "paddingAll": "md",
                "contents": [
                    {
                        "type": "box",
                        "layout": "baseline",
                        "contents": [
                             {"type": "text", "text": date_str, "weight": "bold", "color": "#2B303B", "size": "sm", "flex": 1},
                             {"type": "text", "text": f"{score}/10", "weight": "bold", "color": score_color, "size": "sm", "flex": 0, "align": "end"}
                        ]
                    },
                    {"type": "text", "text": time_str, "weight": "bold", "color": "#2B303B", "size": "xl", "wrap": True, "margin": "xs"}
                ]
            },
            "body": {
                "type": "box",
                "layout": "vertical",
                "paddingAll": "md",
                "spacing": "md",
                "contents": [
                    # Attendees Section
                    {
                        "type": "box",
                        "layout": "vertical",
                        "spacing": "xs",
                        "contents": [
                            {"type": "text", "text": "Available Users", "weight": "bold", "size": "xs", "color": "#aaaaaa"},
                            {
                                "type": "box",
                                "layout": "horizontal",
                                "spacing": "xs",
                                "contents": [
                                    {"type": "image", "url": url, "size": "xxs", "aspectRatio": "1:1", "aspectMode": "cover", "cornerRadius": "full"} for url in attendees[:7] # Show max 7 icons to fit
                                ] + ([{"type": "text", "text": f"+{len(attendees)-7}", "size": "xxs", "color": "#aaaaaa", "gravity": "center", "flex": 0}] if len(attendees) > 7 else [])
                            } if attendees else {"type": "text", "text": "None", "size": "sm", "color": "#555555"}
                        ]
                    },
                    # Separator
                    {"type": "separator", "margin": "md", "color": "#dddddd"},
                    # Top Restaurant Teaser
                    {
                        "type": "box",
                        "layout": "vertical",
                        "margin": "md",
                        "spacing": "xs",
                        "contents": [
                            {"type": "text", "text": "Top 5 Recommendations", "weight": "bold", "size": "xs", "color": "#aaaaaa"},
                            * [
                                {
                                    "type": "box",
                                    "layout": "baseline",
                                    "contents": [
                                        {"type": "text", "text": f"{i+1}. {r.get('name', 'N/A')}", "size": "xs", "color": "#333333", "flex": 4, "wrap": True},
                                        {"type": "text", "text": f"{r.get('score', 0):.1f}", "size": "xs", "color": "#F58357", "flex": 0, "align": "end", "weight": "bold"}
                                    ]
                                } for i, r in enumerate(restaurants[:5])
                            ]
                        ]
                    }
                ]
            },
            "footer": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "button",
                        "style": "primary",
                        "height": "sm",
                        "color": "#F58357",
                        "action": {
                            "type": "uri",
                            "label": "View Details",
                            "uri": result_url
                        }
                    }
                ]
            }
        }
        if len(restaurants) > 0:
            bubbles.append(bubble)
    
    carousel = {
        "type": "carousel",
        "contents": bubbles
    }

    try:
        # Validate group_id before sending
        if not group_id or group_id.strip() == "":
            print(f"ERROR: Invalid group_id (empty or None): '{group_id}'")
            return
        
        print(f"Attempting to push result message to group_id: {group_id}")
        print(f"Group ID type: {type(group_id)}, length: {len(group_id)}")
        
        with ApiClient(configuration) as api_client:
            line_bot_api = MessagingApi(api_client)
            line_bot_api.push_message(
                PushMessageRequest(
                    to=group_id,
                    messages=[FlexMessage(alt_text=f"Suggestions for {meeting_name}", contents=FlexContainer.from_dict(carousel))]
                )
            )
            print(f"✅ Successfully pushed Result Carousel to {group_id}")
    except Exception as e:
        print(f"❌ Error pushing result message: {e}")
        print(f"Group ID was: '{group_id}'")

from models import UserDetail
from services.postgres_services import SessionLocal

# ... (existing imports)

def register_line_user(api_client, user_id, group_id):
    try:
        line_bot_api = MessagingApi(api_client)
        # 1. Fetch Profile
        try:
            profile = line_bot_api.get_profile(user_id)
        except Exception as e:
            print(f"Failed to fetch profile for {user_id}: {e}")
            return None, "ไม่สามารถดึงข้อมูลโปรไฟล์ได้"

        print("Profile:", profile)

        # 2. Save to Database
        db = SessionLocal()
        try:
            user = db.query(UserDetail).filter(UserDetail.user_id == user_id).first()
            if not user:
                user = UserDetail(
                    user_id=user_id,
                    display_name=profile.display_name,
                    pictureurl=profile.picture_url or "",
                    group_id=group_id
                )
                db.add(user)
            else:
                # Update existing
                user.display_name = profile.display_name
                user.pictureurl = profile.picture_url or ""
                if group_id:
                    user.group_id = group_id
            
            db.commit()
            return profile, "Success"
        except Exception as e:
            print(f"DB Error: {e}")
            db.rollback()
            return None, "เกิดข้อผิดพลาดในการบันทึกข้อมูล"
        finally:
            db.close()

    except Exception as e:
        print(f"Register Error: {e}")
        return None, "Error"

@handler.add(MessageEvent, message=TextMessageContent)
def handle_message(event):
    user_text = event.message.text
    
    # Extract IDs
    user_id = event.source.user_id if hasattr(event.source, 'user_id') else None
    group_id = event.source.group_id if hasattr(event.source, 'group_id') else None

    # Custom Logic: Respond differently based on user input
    user_text_lower = user_text.lower()
    
    if any(cmd in user_text_lower for cmd in ["#สร้างนัด", "#create-meeting", "#create-meeing"]):
        flex_content = create_flex_message(user_id, group_id)
        messages=[
            FlexMessage(
                alt_text="Create Meeting",
                contents=FlexContainer.from_dict(flex_content)
            )
        ]
    elif "#register" in user_text_lower:
        if not user_id:
             messages = [TextMessage(text="Error: Could not identify user.")]
        else:
            with ApiClient(configuration) as api_client:
                profile, msg = register_line_user(api_client, user_id, group_id)
                if profile:
                    messages = [TextMessage(text=f"ลงทะเบียนเรียบร้อยครับคุณ {profile.display_name}!")]
                else:
                    messages = [TextMessage(text=msg)]

    else:
        # Help / Unknown Command Flex Message
        help_flex = {
            "type": "bubble",
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {"type": "text", "text": "🤖 COMMANDS", "weight": "bold", "color": "#1DB446", "size": "sm"},
                    {"type": "text", "text": "I didn't quite catch that.", "size": "xs", "color": "#aaaaaa", "wrap": True, "margin": "none"},
                    {"type": "separator", "margin": "md"},
                    {
                        "type": "box",
                        "layout": "vertical",
                        "margin": "md",
                        "spacing": "sm",
                        "contents": [
                            {
                                "type": "box",
                                "layout": "baseline",
                                "contents": [
                                    {"type": "text", "text": "#create-meeting", "weight": "bold", "color": "#333333", "size": "sm", "flex": 0},
                                    {"type": "text", "text": " / ", "color": "#aaaaaa", "size": "sm", "flex": 0},
                                    {"type": "text", "text": "#สร้างนัด", "weight": "bold", "color": "#333333", "size": "sm", "flex": 0},
                                ]
                            },
                             {"type": "text", "text": "Start a new voting session", "size": "xs", "color": "#aaaaaa", "wrap": True},
                             
                             {"type": "separator", "margin": "sm"},

                             {
                                "type": "box",
                                "layout": "baseline",
                                "contents": [
                                    {"type": "text", "text": "#register", "weight": "bold", "color": "#333333", "size": "sm", "flex": 0}
                                ],
                                "margin": "sm"
                            },
                             {"type": "text", "text": "Register your profile with the bot", "size": "xs", "color": "#aaaaaa", "wrap": True}
                        ]
                    }
                ]
            }
        }
        
        messages = [
            FlexMessage(
                alt_text="Bot Commands",
                contents=FlexContainer.from_dict(help_flex)
            )
        ]

    # Reply Messages
    with ApiClient(configuration) as api_client:
        line_bot_api = MessagingApi(api_client)
        line_bot_api.reply_message(
            ReplyMessageRequest(
                reply_token=event.reply_token,
                messages = messages
            )
        )

@handler.add(JoinEvent)
def handle_join(event):
    group_id = event.source.group_id if hasattr(event.source, 'group_id') else None
    user_id = getattr(event.source, 'user_id', None)
    
    # Try to register if user_id is present (might not be in Group Join)
    if user_id:
        with ApiClient(configuration) as api_client:
             register_line_user(api_client, user_id, group_id)
    
    flex_content = create_flex_message(user_id=user_id, group_id=group_id)

    messages = [
        TextMessage(text="สวัสดีครับ! ขอบคุณที่เชิญผมเข้ากลุ่ม\nพิมพ์ '#สร้างนัด' เพื่อเริ่มใช้งาน หรือกดปุ่มด้านล่างได้เลยครับ"),
        FlexMessage(
            alt_text="Welcome Message",
            contents=FlexContainer.from_dict(flex_content)
        )
    ]

    with ApiClient(configuration) as api_client:
        line_bot_api = MessagingApi(api_client)
        line_bot_api.reply_message(
            ReplyMessageRequest(
                reply_token=event.reply_token,
                messages=messages
            )
        )

@handler.add(MemberJoinedEvent)
def handle_member_joined(event):
    # This event contains a list of userIds who joined
    new_members = event.joined.members
    group_id = event.source.group_id if hasattr(event.source, 'group_id') else None
    
    # Save new members to database
    if group_id:
        with SessionLocal() as db:
            for member in new_members:
                user_id = member.user_id
                
                # Check if user already exists
                existing_user = db.query(UserDetail).filter(
                    UserDetail.user_id == user_id
                ).first()
                
                if not existing_user:
                    try:
                        # Fetch LINE profile
                        with ApiClient(configuration) as api_client:
                            line_bot_api = MessagingApi(api_client)
                            profile = line_bot_api.get_group_member_profile(group_id, user_id)
                        
                        # Create new user
                        new_user = UserDetail(
                            user_id=user_id,
                            display_name=profile.display_name,
                            picture_url=profile.picture_url,
                            group_id=group_id
                        )
                        db.add(new_user)
                        db.commit()
                        print(f"✅ Added new user: {profile.display_name} ({user_id}) to group {group_id}")
                    except Exception as e:
                        print(f"❌ Failed to add user {user_id}: {e}")
                        db.rollback()
                else:
                    print(f"ℹ️ User {user_id} already exists in database")
    
    # Send welcome message
    messages = [TextMessage(text=f"ยินดีต้อนรับสมาชิกใหม่! อย่าลืมพิมพ์ '#สร้างนัด' นะครับ")]

    with ApiClient(configuration) as api_client:
        line_bot_api = MessagingApi(api_client)
        line_bot_api.reply_message(
            ReplyMessageRequest(
                reply_token=event.reply_token,
                messages=messages
            )
        )
