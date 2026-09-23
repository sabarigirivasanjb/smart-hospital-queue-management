import urllib.request, json

# Test reception login
data = json.dumps({'email': 'reception@hospital.com', 'password': 'Reception@123'}).encode()
req = urllib.request.Request(
    'http://127.0.0.1:8000/api/v1/auth/login',
    data=data,
    headers={'Content-Type': 'application/json'}
)
try:
    r = json.loads(urllib.request.urlopen(req).read())
    print('ROLE:', r['role'])
    print('NAME:', r['full_name'])
    token = r['access_token']
    print('LOGIN OK!')

    # Test dashboard
    req2 = urllib.request.Request(
        'http://127.0.0.1:8000/api/v1/reception/dashboard',
        headers={'Authorization': 'Bearer ' + token}
    )
    dash = json.loads(urllib.request.urlopen(req2).read())
    print('DASHBOARD OK:', dash)

    # Test queue
    req3 = urllib.request.Request(
        'http://127.0.0.1:8000/api/v1/reception/queue',
        headers={'Authorization': 'Bearer ' + token}
    )
    queue = json.loads(urllib.request.urlopen(req3).read())
    print('QUEUE OK: items =', len(queue))

    print('\n=== ALL RECEPTION ENDPOINTS OK ===')

except urllib.error.HTTPError as e:
    print('ERROR:', e.code, e.read().decode())
except Exception as e:
    print('EXCEPTION:', e)
