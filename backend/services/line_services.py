import os
from dotenv import load_dotenv

load_dotenv()

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

# Load from environment
LINE_CHANNEL_ACCESS_TOKEN = os.getenv('LINE_CHANNEL_ACCESS_TOKEN')
LINE_CHANNEL_SECRET = os.getenv('LINE_CHANNEL_SECRET')
LIFF_ID = os.getenv('LIFF_ID')
ENABLE_BETA_SURVEY = os.getenv('ENABLE_BETA_SURVEY', 'true').lower() == 'true'

configuration = Configuration(access_token=LINE_CHANNEL_ACCESS_TOKEN)

# Patch: set 5s timeout on all LINE API requests so tests don't hang on invalid tokens
_original_api_client = ApiClient
class _TimedApiClient(ApiClient):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.rest_client.timeout = 5
ApiClient = _TimedApiClient

handler = WebhookHandler(LINE_CHANNEL_SECRET)

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
                    "uri": f"https://liff.line.me/{LIFF_ID}"
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
    # LIFF_ID = "2008419367-SeVLxzHP"
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

def push_message_creation_flex(group_id: str, meeting_id: str, meeting_name: str, meal_time: str, start_date: str = "", end_date: str = "", fixed_restaurant: str = "", fixed_location: str = "", fixed_restaurant_url: str = ""):
    if not group_id:
        return

    # Link: /availability?group_id=...&meeting_id=...
    # LIFF_ID = "2008419367-SeVLxzHP"
    params = []
    if group_id:
        params.append(f"group_id={group_id}")
    if meeting_id:
        params.append(f"meeting_id={meeting_id}")

    query_string = "?" + "&".join(params) if params else ""
    vote_url = f"https://liff.line.me/{LIFF_ID}/availability{query_string}"
    
    # Format Period/Date String
    is_fixed_time = not end_date or end_date == "N/A" or end_date == ""
    date_label = "Date" if is_fixed_time else "Period"
    date_val = start_date if is_fixed_time else (f"{start_date} - {end_date}" if start_date and end_date != "N/A" else start_date)

    # Build Info Rows
    info_rows = [
        {
            "type": "box",
            "layout": "baseline",
            "spacing": "sm",
            "contents": [
                {"type": "text", "text": date_label, "color": "#aaaaaa", "size": "sm", "flex": 2},
                {"type": "text", "text": date_val, "wrap": True, "color": "#2B303B", "size": "sm", "flex": 4}
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

    if fixed_restaurant:
        info_rows.append({
            "type": "box",
            "layout": "baseline",
            "spacing": "sm",
            "contents": [
                {"type": "text", "text": "Restaurant", "color": "#aaaaaa", "size": "sm", "flex": 2},
                {"type": "text", "text": fixed_restaurant, "wrap": True, "color": "#F58357", "size": "sm", "flex": 4, "weight": "bold"}
            ]
        })

    if fixed_location:
        info_rows.append({
            "type": "box",
            "layout": "baseline",
            "spacing": "sm",
            "contents": [
                {"type": "text", "text": "Location", "color": "#aaaaaa", "size": "sm", "flex": 2},
                {"type": "text", "text": fixed_location, "wrap": True, "color": "#2B303B", "size": "sm", "flex": 4}
            ]
        })

    # Build Footer Buttons
    footer_contents = [
        {
            "type": "button",
            "style": "primary",
            "height": "sm",
            "color": "#F58357",
            "action": {
                "type": "uri",
                "label": "Add Preferences",
                "uri": vote_url
            }
        }
    ]

    # Add Wongnai button if URL is provided
    if fixed_restaurant_url and str(fixed_restaurant_url).startswith('http'):
        footer_contents.append({
            "type": "button",
            "style": "secondary",
            "height": "sm",
            "color": "#F58357",
            "action": {
                "type": "uri",
                "label": "View on Wongnai",
                "uri": fixed_restaurant_url
            }
        })

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
                    "contents": info_rows
                }
            ]
        },
        "footer": {
            "type": "box",
            "layout": "vertical",
            "spacing": "sm",
            "contents": footer_contents,
            "flex": 0
        }
    }

    try:
        with ApiClient(configuration) as api_client:
            api_client.rest_client.timeout = 5
            line_bot_api = MessagingApi(api_client)
            line_bot_api.push_message(
                PushMessageRequest(
                    to=group_id,
                    messages=[FlexMessage(alt_text=f"New Meeting: {meeting_name}", contents=FlexContainer.from_dict(flex))]
                )
            )
            print(f"Pushed Creation Flex to {group_id}")
    except Exception as e:
        error_msg = str(e)
        if "monthly limit" in error_msg.lower() or "429" in error_msg:
            print("🛑 CRITICAL: LINE Messaging API monthly quota reached!")
            print("Please check your LINE Official Account Manager (https://manager.line.biz/).")
        else:
            print(f"Error pushing creation message: {e}")

def push_message_result_flex(group_id, meeting_id, meeting_name, top_slots, preferred_restaurants=None, all_scored_restaurants=None, meal_time="", start_date="", end_date="", fixed_restaurant=None, total_attendees=0):
    """
    Push a Flex Message with the voting results/suggestions to a LINE group.
    """
    if not group_id:
        return

    # 1. Build Slots Summary Items
    summary_items = []
    for i, slot in enumerate(top_slots[:5]):
        # Format date for display (e.g. 12/09)
        date_obj = slot['date']
        date_str = date_obj.strftime("%d/%m") if hasattr(date_obj, 'strftime') else str(date_obj)
        time_str = slot['time']
        score = slot['final_score']
        
        # Calculate participation
        at_count = len(slot.get('attendees', []))
        is_partial = total_attendees > 0 and at_count < total_attendees
        
        score_color = "#FFD700" if score >= 8 else "#F58357" if score >= 5 else "#666666"
        at_label = f"({at_count}/{total_attendees})" if total_attendees > 0 else f"({at_count})"
        
        summary_items.append({
            "type": "box",
            "layout": "vertical",
            "contents": [
                {
                    "type": "box",
                    "layout": "baseline",
                    "contents": [
                        {"type": "text", "text": f"{i+1}.", "size": "sm", "color": "#2B303B", "flex": 1, "weight": "bold"},
                        {"type": "text", "text": f"{date_str} {time_str} {at_label}", "size": "sm", "color": "#555555" if not is_partial else "#F58357", "flex": 6, "wrap": True},
                        {"type": "text", "text": f"{score:.1f}", "size": "sm", "color": score_color, "flex": 2, "align": "end", "weight": "bold"}
                    ]
                },
                {"type": "text", "text": ", ".join(slot.get('attendee_names', [])), "size": "xxs", "color": "#aaaaaa", "wrap": True, "margin": "xs", "flex": 0}
            ],
            "margin": "sm"
        })

    # Determine meeting status
    is_fixed_time = not end_date or end_date == "N/A" or end_date == ""
    is_fixed_restaurant = fixed_restaurant is not None
    
    base_params = []
    if group_id:
        base_params.append(f"group_id={group_id}")
    if meeting_id:
        base_params.append(f"meeting_id={meeting_id}")
    
    base_query_string = "?" + "&".join(base_params) if base_params else ""
    base_result_url = f"https://liff.line.me/{LIFF_ID}/result{base_query_string}"

    # 0. Meeting Summary Bubble (Hero) - Styled like push_message_fixed_result_flex
    date_label = "Date" if is_fixed_time else "Period"
    date_val = start_date if is_fixed_time else (f"{start_date} - {end_date}" if start_date and end_date != "N/A" else start_date)
    
    # Header title logic
    if is_fixed_time and is_fixed_restaurant:
        hero_header_title = "📍 Finalized Meeting"
    elif is_fixed_time:
        hero_header_title = "📍 Time Finalized"
    elif is_fixed_restaurant:
        hero_header_title = "📍 Restaurant Fixed"
    else:
        hero_header_title = "Suggestions Ready"
    
    # Build Hero Body Contents
    hero_body_contents = [
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
                        {"type": "text", "text": date_label, "color": "#aaaaaa", "size": "sm", "flex": 2},
                        {"type": "text", "text": date_val, "wrap": True, "color": "#2B303B", "size": "sm", "flex": 4}
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

    # Add Fixed Restaurant info to Hero if applicable
    if is_fixed_restaurant:
        restaurant_name = fixed_restaurant.get('name', 'N/A')
        hero_body_contents.append({"type": "separator", "margin": "lg"})
        hero_body_contents.append({
            "type": "box",
            "layout": "vertical",
            "margin": "lg",
            "spacing": "xs",
            "contents": [
                {"type": "text", "text": "Confirmed Restaurant", "weight": "bold", "size": "xs", "color": "#aaaaaa"},
                {"type": "text", "text": restaurant_name, "weight": "bold", "size": "lg", "color": "#F58357", "margin": "xs", "wrap": True},
                {"type": "text", "text": f"✨ Recommended by {fixed_restaurant.get('suggestion_count', 0)} friends" if fixed_restaurant.get('suggestion_count', 0) > 0 else "📍 Organizer's Choice", "size": "xs", "color": "#aaaaaa"}
            ]
        })

    # Add Attendees if Fixed Time or Partial Match
    is_partial_match = False
    if top_slots:
        at_count = len(top_slots[0].get('attendees', []))
        is_partial_match = total_attendees > 0 and at_count < total_attendees

    if is_fixed_time and top_slots:
        attendees = top_slots[0].get('attendees', [])
        hero_body_contents.append({"type": "separator", "margin": "lg"})
        hero_body_contents.append({
            "type": "box",
            "layout": "vertical",
            "margin": "lg",
            "spacing": "sm",
            "contents": [
                {"type": "text", "text": "Confirmed Attendees", "weight": "bold", "size": "xs", "color": "#aaaaaa"},
                {
                    "type": "box",
                    "layout": "horizontal",
                    "spacing": "xs",
                    "contents": [
                        {"type": "image", "url": url, "size": "xxs", "aspectRatio": "1:1", "aspectMode": "cover", "cornerRadius": "full"} for url in attendees[:10]
                    ] + ([{"type": "text", "text": f"+{len(attendees)-10}", "size": "xxs", "color": "#aaaaaa", "gravity": "center", "flex": 0}] if len(attendees) > 10 else [])
                } if attendees else {"type": "text", "text": "None", "size": "sm", "color": "#555555"}
            ]
        })
    elif is_partial_match:
        # Show partial match warning
        hero_body_contents.append({"type": "separator", "margin": "lg"})
        hero_body_contents.append({
            "type": "box",
            "layout": "vertical",
            "margin": "lg",
            "spacing": "xs",
            "contents": [
                {"type": "text", "text": "💡 Best Match (Partial)", "weight": "bold", "size": "sm", "color": "#F58357"},
                {"type": "text", "text": "No time slots where everyone is free. Here are the best alternatives based on majority availability.", "size": "xs", "color": "#aaaaaa", "wrap": True}
            ]
        })
    elif not top_slots and not is_fixed_time:
        # Show warning if truly no slots found
        hero_body_contents.append({"type": "separator", "margin": "lg"})
        hero_body_contents.append({
            "type": "box",
            "layout": "vertical",
            "margin": "lg",
            "spacing": "xs",
            "contents": [
                {"type": "text", "text": "⚠️ No Common Time Found", "weight": "bold", "size": "sm", "color": "#F58357"},
                {"type": "text", "text": "No time slots found. Try adjusting the period or adding more flexibility.", "size": "xs", "color": "#aaaaaa", "wrap": True}
            ]
        })

    # Extract Wongnai URL from fixed restaurant if applicable
    wongnai_url = None
    if is_fixed_restaurant:
        wongnai_url = fixed_restaurant.get('url') or fixed_restaurant.get('wongnai_url') or fixed_restaurant.get('wongnai_link')
        if wongnai_url and not str(wongnai_url).startswith('http'):
            wongnai_url = f"https://{wongnai_url}"

    meeting_summary_bubble = {
        "type": "bubble",
        "size": "kilo",
        "header": {
            "type": "box",
            "layout": "vertical",
            "backgroundColor": "#F58357", # Primary Color
            "paddingAll": "lg",
            "contents": [
                {"type": "text", "text": hero_header_title, "weight": "bold", "color": "#FFFFFF", "size": "sm"},
                {"type": "text", "text": meeting_name, "weight": "bold", "size": "xl", "color": "#FFFFFF", "wrap": True, "margin": "md"}
            ]
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "contents": hero_body_contents
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
                        "label": "View on Wongnai" if is_fixed_restaurant and wongnai_url else "Open Results Page",
                        "uri": wongnai_url if is_fixed_restaurant and wongnai_url else base_result_url
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
                        "label": "See Suggestions & Vote",
                        "uri": base_result_url
                    }
                }
            ]
        }
    }

    bubbles = [meeting_summary_bubble]
    if not is_fixed_time:
        bubbles.append(summary_bubble)

    # Add Preferred Restaurants Bubble if available (SKIP if restaurant is already fixed)
    if preferred_restaurants and not is_fixed_restaurant:
        pref_items = []
        for i, r in enumerate(preferred_restaurants[:10]):
            pref_items.append({
                "type": "box",
                "layout": "baseline",
                "contents": [
                    {"type": "text", "text": f"{i+1}.", "size": "sm", "color": "#2B303B", "flex": 1, "weight": "bold"},
                    {"type": "text", "text": r.get('name', 'N/A'), "size": "sm", "color": "#555555", "flex": 6, "wrap": True},
                    {"type": "text", "text": f"({r.get('suggestion_count', 0)} votes)", "size": "xs", "color": "#F58357", "flex": 3, "align": "end", "weight": "bold"}
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
                    {"type": "text", "text": "Friend Suggestions", "weight": "bold", "size": "lg", "color": "#FFFFFF"},
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
                            "label": "See Suggestions & Vote",
                            "uri": base_result_url
                        }
                    }
                ]
            }
        }
        bubbles.append(preferred_bubble)
    
    # Bubble for Global Discovery Ranking (SKIP if restaurant is already fixed)
    if all_scored_restaurants and not is_fixed_restaurant:
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
                    {"type": "text", "text": "Suggested Restaurants", "weight": "bold", "size": "lg", "color": "#FFFFFF"},
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
                            "label": "See Suggestions & Vote",
                            "uri": base_result_url
                        }
                    }
                ]
            }
        }
        bubbles.append(discovery_bubble)
    if len(top_slots) > 0:
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
                                {"type": "text", "text": f"Available Users ({len(attendees)})", "weight": "bold", "size": "xs", "color": "#aaaaaa"},
                                {
                                    "type": "box",
                                    "layout": "horizontal",
                                    "spacing": "xs",
                                    "contents": [
                                        {"type": "image", "url": url, "size": "xxs", "aspectRatio": "1:1", "aspectMode": "cover", "cornerRadius": "full"} for url in attendees[:7] # Show max 7 icons to fit
                                    ] + ([{"type": "text", "text": f"+{len(attendees)-7}", "size": "xxs", "color": "#aaaaaa", "gravity": "center", "flex": 0}] if len(attendees) > 7 else [])
                                } if attendees else {"type": "text", "text": "None", "size": "sm", "color": "#555555"},
                                {"type": "text", "text": ", ".join(slot.get('attendee_names', [])), "size": "xxs", "color": "#aaaaaa", "wrap": True, "margin": "xs"}
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
        error_msg = str(e)
        if "monthly limit" in error_msg.lower() or "429" in error_msg:
            print("🛑 CRITICAL: LINE Messaging API monthly quota reached!")
            print("The bot cannot send any more push messages this month on your current plan.")
            print("Please check your LINE Official Account Manager (https://manager.line.biz/) to upgrade or wait until next month.")
        else:
            print(f"❌ Error pushing result message: {e}")
            print(f"Group ID was: '{group_id}'")

def push_message_fixed_result_flex(group_id: str, meeting_id: str, meeting_name: str, slot: dict, fixed_restaurant: dict, meal_time: str = "", start_date: str = ""):
    if not group_id:
        return
    
    # base_params uses global LIFF_ID
    base_params = [f"group_id={group_id}", f"meeting_id={meeting_id}"]
    base_query_string = "?" + "&".join(base_params)
    result_url = f"https://liff.line.me/{LIFF_ID}/result{base_query_string}"

    attendees = slot.get('attendees', [])
    restaurant_name = fixed_restaurant.get('name', 'N/A')
    
    wongnai_url = fixed_restaurant.get('url') or fixed_restaurant.get('wongnai_url')
    final_link = wongnai_url if (wongnai_url and str(wongnai_url).startswith('http')) else result_url
    button_label = "View on Wongnai" if (wongnai_url and str(wongnai_url).startswith('http')) else "Open Results Page"

    # Design Fixed Bubble
    fixed_bubble = {
        "type": "bubble",
        "header": {
            "type": "box",
            "layout": "vertical",
            "backgroundColor": "#F58357", # Primary Color
            "paddingAll": "lg",
            "contents": [
                {"type": "text", "text": "📍 Finalized Meeting", "weight": "bold", "color": "#FFFFFF", "size": "sm"},
                {"type": "text", "text": meeting_name, "weight": "bold", "size": "xl", "color": "#FFFFFF", "wrap": True, "margin": "md"}
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
                                {"type": "text", "text": "Date", "color": "#aaaaaa", "size": "sm", "flex": 2},
                                {"type": "text", "text": start_date, "wrap": True, "color": "#2B303B", "size": "sm", "flex": 4}
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
                },
                {"type": "separator", "margin": "lg"},
                {
                    "type": "box",
                    "layout": "vertical",
                    "margin": "lg",
                    "spacing": "xs",
                    "contents": [
                        {"type": "text", "text": "Confirmed Restaurant", "weight": "bold", "size": "xs", "color": "#aaaaaa"},
                        {"type": "text", "text": restaurant_name, "weight": "bold", "size": "lg", "color": "#F58357", "margin": "xs", "wrap": True},
                        {"type": "text", "text": f"✨ Recommended by {fixed_restaurant.get('suggestion_count', 0)} friends" if fixed_restaurant.get('suggestion_count', 0) > 0 else "📍 Organizer's Choice", "size": "xs", "color": "#aaaaaa"}
                    ]
                },
                {
                    "type": "box",
                    "layout": "vertical",
                    "margin": "lg",
                    "spacing": "sm",
                    "contents": [
                        {"type": "text", "text": "Confirmed Attendees", "weight": "bold", "size": "xs", "color": "#aaaaaa"},
                        {
                            "type": "box",
                            "layout": "horizontal",
                            "spacing": "xs",
                            "contents": [
                                {"type": "image", "url": url, "size": "xxs", "aspectRatio": "1:1", "aspectMode": "cover", "cornerRadius": "full"} for url in attendees[:10]
                            ] + ([{"type": "text", "text": f"+{len(attendees)-10}", "size": "xxs", "color": "#aaaaaa", "gravity": "center", "flex": 0}] if len(attendees) > 10 else [])
                        } if attendees else {"type": "text", "text": "None", "size": "sm", "color": "#555555"}
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
                    "color": "#F58357",
                    "action": {
                        "type": "uri",
                        "label": button_label,
                        "uri": final_link
                    }
                }
            ]
        }
    }

    feedback_url = f"https://liff.line.me/{LIFF_ID}/{meeting_id}/feedback{base_query_string}"

    # Design Feedback Invitation Bubble
    feedback_bubble = {
        "type": "bubble",
        "header": {
            "type": "box",
            "layout": "vertical",
            "backgroundColor": "#2B303B",
            "paddingAll": "lg",
            "contents": [
                {"type": "text", "text": "📝 Beta Feedback Survey", "weight": "bold", "color": "#F58357", "size": "sm"},
                {"type": "text", "text": "ช่วยประเมินความพึงพอใจ", "weight": "bold", "size": "md", "color": "#FFFFFF", "wrap": True, "margin": "xs"}
            ]
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {
                    "type": "text",
                    "text": "กรุณาทำแบบประเมินความพึงพอใจการใช้งานแอปพลิเคชัน DISHCISION เพื่อนำข้อมูลไปประกอบการทำวิทยานิพนธ์ระดับปริญญาโทครับ 🙏",
                    "color": "#555555",
                    "size": "xs",
                    "wrap": True
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
                    "color": "#F58357",
                    "action": {
                        "type": "uri",
                        "label": "ทำแบบประเมิน (Feedback)",
                        "uri": feedback_url
                    }
                }
            ]
        }
    }

    try:
        with ApiClient(configuration) as api_client:
            line_bot_api = MessagingApi(api_client)
            
            messages = [FlexMessage(alt_text=f"Final Result: {meeting_name}", contents=FlexContainer.from_dict(fixed_bubble))]
            if ENABLE_BETA_SURVEY:
                messages.append(FlexMessage(alt_text="Beta Feedback Survey", contents=FlexContainer.from_dict(feedback_bubble)))
                
            line_bot_api.push_message(
                PushMessageRequest(
                    to=group_id,
                    messages=messages
                )
            )
            print(f"✅ Successfully pushed Fixed Result and Feedback Flex to {group_id}")
    except Exception as e:
        error_msg = str(e)
        if "monthly limit" in error_msg.lower() or "429" in error_msg:
            print("🛑 CRITICAL: LINE Messaging API monthly quota reached!")
            print("Please check your LINE Official Account Manager (https://manager.line.biz/).")
        else:
            print(f"❌ Error pushing fixed result message: {e}")


from models import UserDetail
from services.postgres_services import SessionLocal

# ... (existing imports)

def sync_group_members(api_client, group_id):
    if not group_id:
        return
    try:
        line_bot_api = MessagingApi(api_client)
        print(f"Syncing members for group: {group_id}")
        
        # 1. Get member IDs
        try:
            response = line_bot_api.get_group_members_ids(group_id)
            member_ids = response.member_ids
            # Handle pagination
            while response.next_:
                response = line_bot_api.get_group_members_ids(group_id, start=response.next_)
                member_ids.extend(response.member_ids)
        except Exception as e:
            print(f"Failed to get group member IDs for {group_id}: {e}")
            return
            
        print(f"Found {len(member_ids)} members in group {group_id}")
        
        # 2. Get profiles and register them
        db = SessionLocal()
        try:
            for member_id in member_ids:
                # Check if already registered with this group_id and details up to date
                user = db.query(UserDetail).filter(UserDetail.user_id == member_id).first()
                if user and user.group_id == group_id and user.display_name and user.pictureurl:
                    continue
                
                try:
                    profile = line_bot_api.get_group_member_profile(group_id, member_id)
                    if not user:
                        user = UserDetail(
                            user_id=member_id,
                            display_name=profile.display_name,
                            pictureurl=profile.picture_url or "",
                            group_id=group_id
                        )
                        db.add(user)
                    else:
                        user.display_name = profile.display_name
                        user.pictureurl = profile.picture_url or ""
                        user.group_id = group_id
                    db.commit()
                    print(f"Synced member: {profile.display_name}")
                except Exception as pe:
                    print(f"Failed to fetch profile for member {member_id} in group {group_id}: {pe}")
        finally:
            db.close()
    except Exception as e:
        print(f"Error syncing group members: {e}")


def register_line_user(api_client, user_id, group_id):
    try:
        # Check if already registered first to avoid unnecessary LINE API calls
        db = SessionLocal()
        try:
            user = db.query(UserDetail).filter(UserDetail.user_id == user_id).first()
            if user and user.group_id == group_id and user.display_name and user.pictureurl:
                # Mock a profile class to return
                class MockProfile:
                    def __init__(self, display_name, picture_url):
                        self.display_name = display_name
                        self.picture_url = picture_url
                profile = MockProfile(user.display_name, user.pictureurl)
                return profile, "Success"
        finally:
            db.close()

        line_bot_api = MessagingApi(api_client)
        # 1. Fetch Profile
        try:
            if group_id:
                profile = line_bot_api.get_group_member_profile(group_id, user_id)
            else:
                profile = line_bot_api.get_profile(user_id)
        except Exception as e:
            # Fallback to get_profile
            try:
                profile = line_bot_api.get_profile(user_id)
            except Exception as e2:
                print(f"Failed to fetch profile for {user_id}: {e2}")
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

    # Auto-register/update sender on any group message
    if user_id and group_id:
        try:
            with ApiClient(configuration) as api_client:
                register_line_user(api_client, user_id, group_id)
        except Exception as e:
            print(f"Auto-register error: {e}")

    # Custom Logic: Respond differently based on user input
    user_text_lower = user_text.lower()
    
    if any(cmd in user_text_lower for cmd in ["#สร้างนัด", "#create-meeting", "#create-meeing"]):
        flex_content = create_flex_message(user_id, group_id)
        # Register user on create meeting command
        if user_id:
            with ApiClient(configuration) as api_client:
                register_line_user(api_client, user_id, group_id)
                # Also sync group members if we are in a group
                if group_id:
                    sync_group_members(api_client, group_id)
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
             
    # Sync all group members when bot joins a group
    if group_id:
        try:
            with ApiClient(configuration) as api_client:
                sync_group_members(api_client, group_id)
        except Exception as e:
            print(f"Error syncing group members on join: {e}")
    
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
