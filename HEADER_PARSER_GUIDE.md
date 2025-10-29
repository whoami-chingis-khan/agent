# Header Parser Tool

This tool converts Chrome DevTools headers into JSON format that can be used with the NEPSE Trading Assistant.

## Quick Usage

### Method 1: From File

1. Copy headers from Chrome DevTools and save to a file (e.g., `headers.txt`)
2. Run the parser:

```bash
node parse-headers.js headers.txt
```

### Method 2: From Clipboard (Pipe)

```bash
# On Windows PowerShell
Get-Clipboard | node parse-headers.js

# On Windows CMD (save to file first)
# Copy headers from Chrome, then:
node parse-headers.js headers.txt
```

### Method 3: Direct Paste

```bash
node parse-headers.js < headers.txt
```

## How to Extract Headers from Chrome DevTools

1. **Open TMS in Chrome** and log in
2. **Open DevTools** (F12 or right-click → Inspect)
3. **Go to Network tab**
4. **Perform any action** in TMS (e.g., view portfolio)
5. **Click on any request** to TMS API
6. **Scroll to Request Headers section**
7. **Copy ALL the headers** (right-click → Copy → Copy all headers)
8. **Save to a file** or pipe to the parser

## Example Headers Format

The parser expects Chrome's header format:

```
:authority
tms56.nepsetms.com.np
:method
GET
cookie
_rid=...; _aid=...; XSRF-TOKEN=...
host-session-id
TVRJPS03ZjQ3ZTQzNi0zMTU2LTRkZTAtOGM5Zi00YTkyMWQyMjAxODM=
membercode
56
request-owner
25717
x-xsrf-token
90c03448-3e1b-4acb-899f-b2b4c87f80d4
```

## Output Format

The parser outputs JSON with the required fields:

```json
{
  "x-xsrf-token": "90c03448-3e1b-4acb-899f-b2b4c87f80d4",
  "host-session-id": "TVRJPS03ZjQ3ZTQzNi0zMTU2LTRkZTAtOGM5Zi00YTkyMWQyMjAxODM=",
  "membercode": "56",
  "request-owner": "25717",
  "cookie": "_rid=...; _aid=...; XSRF-TOKEN=..."
}
```

## Using the Output in the App

1. **Copy the JSON output** from the parser
2. **Open the Vite app** at http://localhost:5173
3. **Go to Session tab**
4. **Paste the JSON** into the text area
5. **Click "Activate Session"**

## Alternative: Direct Entry in App

You can also:

1. Click **"Paste from Clipboard"** button in the Session Manager
2. The app will read your clipboard directly
3. Click **"Activate Session"**

## Troubleshooting

### Issue: "Invalid JSON format"
- Make sure you copied ALL headers from Chrome
- Check that the output is valid JSON
- Try copying headers again

### Issue: Missing fields
- Ensure you're logged into TMS
- Make sure you copied from a request to TMS API (not the main page)
- Look for requests to `/tmsapi/` endpoints

### Issue: Session expires quickly
- This is normal - TMS sessions expire
- You'll need to re-extract headers periodically
- The app will auto-refresh when possible

## Tips

- **Copy from recent requests** - Headers from old requests may be expired
- **Look for API calls** - Copy from requests to `/tmsapi/` paths
- **Save your headers** - Keep a backup file (but don't commit to git!)
- **Use fresh sessions** - Always extract from a recently logged-in TMS session

## Security Warning

⚠️ **Never share or commit these headers!** They contain your authentication tokens and can be used to access your TMS account.

- Don't commit `headers.txt` to git
- Don't share in screenshots
- Don't paste in public channels
- Clear the file after use

## Example Workflow

```bash
# 1. Extract headers from Chrome DevTools and save to file
# (manually copy and save to headers.txt)

# 2. Parse headers
node parse-headers.js headers.txt > session.json

# 3. Copy the output
cat session.json

# 4. Paste into the Vite app Session Manager

# 5. Clean up
rm headers.txt session.json
```

## Quick Reference

| Command | Description |
|---------|-------------|
| `node parse-headers.js file.txt` | Parse from file |
| `node parse-headers.js < file.txt` | Parse via stdin |
| `Get-Clipboard \| node parse-headers.js` | Parse from clipboard (PS) |
| `node parse-headers.js file.txt > out.json` | Save to file |

---

**Pro Tip**: Create a keyboard shortcut or script to automate this process!
