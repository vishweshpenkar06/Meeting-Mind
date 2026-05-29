import { NextResponse } from "next/server";
import { DEFAULT_TEMPLATES } from "@/lib/templates";

export async function GET() {
  try {
    return NextResponse.json(DEFAULT_TEMPLATES);
  } catch (err) {
    console.error("Error fetching templates:", err);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(
      {
        error: "Custom templates are not supported in the schema-free fallback mode.",
        templates: DEFAULT_TEMPLATES,
        received: body,
      },
      { status: 501 }
    );
  } catch (err) {
    console.error("Error creating template:", err);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
