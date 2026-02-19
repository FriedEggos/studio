import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // The URL provided by the user
  const appsScriptUrl = "https://script.google.com/macros/s/AKfycbyOt3XVmoHOkHE4QxwLbP3uWPp2ffGbqVDVatF7rX0NqVmuxDnvSSafGzvb68e1JI0keg/exec";
  
  try {
    const payload = await request.json();

    const scriptResponse = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    // It's common for Apps Scripts to redirect on POST. The response URL might change.
    // However, we primarily care if the request was accepted. A 200 OK or a redirect (3xx)
    // can both be considered success in this context, but a simple 'ok' check is often sufficient.
    if (!scriptResponse.ok) {
        const errorText = await scriptResponse.text();
        console.error(`Error from Google Apps Script (POST): ${scriptResponse.status} ${errorText}`);
        return NextResponse.json(
            { error: `Failed to post to Google Sheet. Status: ${scriptResponse.status}. Message: ${errorText}` },
            { status: scriptResponse.status }
        );
    }
    
    // Try to parse the response as JSON, as this is the expected success format.
    // If the script redirects and returns HTML, this will fail, and the catch block will handle it.
    const responseData = await scriptResponse.json();
    return NextResponse.json(responseData);

  } catch (error) {
    console.error("Error in add-program-to-sheet API proxy route:", error);
    let errorMessage = 'An unknown internal server error occurred';
    if (error instanceof Error) {
        errorMessage = error.message;
        // Check for JSON parsing error, which can happen if the script returns HTML after a redirect
        if (error.name === 'SyntaxError') {
          errorMessage = "The Google Apps Script did not return valid JSON. It may have redirected. Please check the script's doPost function.";
        }
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
