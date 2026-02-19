
import { NextResponse } from 'next/server';

export async function GET() {
  const appsScriptUrl = "https://script.google.com/macros/s/AKfycbw0DMJa_qoliZiNhYxBr9046sVtFv3IvWJM-Mfb_bRpjglG__rxZUmgr84PDNz7uvDt4A/exec";
  
  try {
    const response = await fetch(appsScriptUrl, { cache: 'no-store' });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error from Google Apps Script: ${response.status} ${errorText}`);
      
      let detailedError = `Failed to fetch from Google Sheet API: ${response.statusText}`;
      if (response.status === 403) {
          detailedError = "Access Forbidden. Please check your Google Apps Script deployment settings. It must be set to allow access for 'Anyone'.";
      }

      return NextResponse.json(
        { error: detailedError },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("Error in API proxy route:", error);
    if (error instanceof Error) {
        // Check for JSON parsing error, which can happen if the script returns HTML (e.g. login page)
        if (error.name === 'SyntaxError') {
          return NextResponse.json({ error: "The Google Apps Script did not return valid JSON. It may require authorization. Please check the script's deployment settings." }, { status: 500 });
        }
        return NextResponse.json({ error: `Internal Server Error: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ error: 'An unknown internal server error occurred' }, { status: 500 });
  }
}
