const API_KEY = process.env.AI_API_KEY;
const API_URL = process.env.AI_API_URL;
const MODEL = process.env.AI_MODEL;
const PASSWORD = process.env.PASSWORD;

function writeEvent(res, event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Only POST requests are supported' });
    }

    if (!API_KEY || !API_URL || !MODEL) {
        return res.status(500).json({ error: 'AI_API_KEY, AI_API_URL, and AI_MODEL must be configured' });
    }

    const body = req.body || {};
    const { messages, password } = body;

    if (!messages) {
        return res.status(400).json({ error: 'Missing required parameter: messages' });
    }

    if (PASSWORD && password !== PASSWORD) {
        return res.status(401).json({ error: 'Password verification failed' });
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });
    res.flushHeaders?.();
    res.write(': connected\n\n');

    try {
        writeEvent(res, 'status', { message: 'Connecting to AI service...' });

        const baseUrl = API_URL.replace(/\/+$/, '');
        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: MODEL,
                messages,
                stream: true
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI request failed: ${response.status} - ${errorText}`);
        }

        if (!response.body) {
            throw new Error('AI response body is empty');
        }

        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
        }
    } catch (error) {
        console.error('AI API Error:', error);
        writeEvent(res, 'error', { error: error.message });
    } finally {
        res.end();
    }
};
