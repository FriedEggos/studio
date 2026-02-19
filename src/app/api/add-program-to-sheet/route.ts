
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const appsScriptUrl = "https://script.google.com/macros/s/AKfycbw-w4RIeD4LXhP206jU0FYL1Pr8OiFo1JbFkpEwUjkMOwflbKvZpcWnG58DAiHU4SuO2g/exec";
  
  try {
    const payload = await request.json();

    const scriptResponse = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store'
    });

    if (!scriptResponse.ok) {
        const errorText = await scriptResponse.text();
        console.error(`Error from Google Apps Script (POST): ${scriptResponse.status} ${errorText}`);
        
        let detailedError = `Failed to post to Google Sheet. Status: ${scriptResponse.status}. Message: ${errorText}`;
        if (scriptResponse.status === 403) {
            detailedError = "Access Forbidden. Please check your Google Apps Script deployment settings. It must be set to allow access for 'Anyone'.";
        }
        
        return NextResponse.json({ error: detailedError }, { status: scriptResponse.status });
    }
    
    // Attempt to parse JSON, but handle cases where Apps Script returns HTML on success.
    try {
        const responseData = await scriptResponse.json();
        return NextResponse.json(responseData);
    } catch (e) {
        // This is a common success case if the script returns a simple text/html response.
        return NextResponse.json({ success: true, message: "Request processed by Google Sheet." });
    }

  } catch (error) {
    console.error("Error in add-program-to-sheet API proxy route:", error);
    let errorMessage = 'An unknown internal server error occurred';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
