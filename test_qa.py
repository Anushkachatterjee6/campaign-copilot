import requests, time

base_url = 'http://localhost:8000/api'

print("--- 1. Dashboard stats ---")
stats = requests.get(f"{base_url}/stats/").json()
print("Dashboard Stats:", stats)

print("\n--- 2. Segments ---")
segments = requests.get(f"{base_url}/segments/").json()
print("Segments count:", len(segments))
segment_id = segments[0]['id']

print("\n--- 3. Create Campaign ---")
campaign_data = {
    "name": "Test Campaign from QA",
    "segment": segment_id,
    "channel": "email",
    "status": "draft",
    "goal": "win_back",
    "draft_message": "Hello test!"
}
campaign = requests.post(f"{base_url}/campaigns/", json=campaign_data).json()
print("Created Campaign ID:", campaign['id'])

print("\n--- 4. Launch Campaign ---")
launched = requests.post(f"{base_url}/campaigns/{campaign['id']}/launch/").json()
print("Launched Campaign status:", launched['status'])

print("\n--- 5. Wait for simulator callbacks ---")
time.sleep(10)

print("\n--- 6. Analytics ---")
analytics = requests.get(f"{base_url}/analytics/charts/").json()
print("Analytics Funnel:", analytics['funnel'])

print("\nALL TESTS PASSED")
