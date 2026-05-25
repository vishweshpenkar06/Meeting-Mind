import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TEMPLATES } from "@/lib/templates";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Merge default templates with user-created ones
    const { data: userTemplates, error } = await supabase
      .from("meeting_templates")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found (not actually an error)
      console.error("Error fetching templates:", error);
    }

    const customTemplates = (userTemplates || []).map((t) => ({
      name: t.name,
      displayName: t.display_name,
      icon: t.icon || "\uD83D\uDCC4",
      description: t.description || "",
      aiPromptContext: t.ai_prompt_context,
      isCustom: true,
    }));

    const allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];

    return NextResponse.json(allTemplates);
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, displayName, icon, description, aiPromptContext } = body;

    if (!name || !displayName) {
      return NextResponse.json({ error: "Name and displayName required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("meeting_templates")
      .insert({
        user_id: user.id,
        name,
        display_name: displayName,
        icon,
        description,
        ai_prompt_context: aiPromptContext,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Error creating template:", err);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
