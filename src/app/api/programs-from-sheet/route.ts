
import { NextResponse } from 'next/server';

export async function GET() {
  const appsScriptUrl = "https://script.google.com/macros/s/AKfycbyOt3XVmoHOkHE4QxwLbP3uWPp2ffGbqVDVatF7rX0NqVmuxDnvSSafGzvb68e1JI0keg/exec";
  
  try {
    const response = await fetch(appsScriptUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error from Google Apps Script: ${response.status} ${errorText}`);
      return NextResponse.json(
        { error: `Failed to fetch from Google Sheet API: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("Error in API proxy route:", error);
    if (error instanceof Error) {
        return NextResponse.json({ error: `Internal Server Error: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ error: 'An unknown internal server error occurred' }, { status: 500 });
  }
}
