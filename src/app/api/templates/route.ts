import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TEMPLATES } from "@/lib/templates";
import { limitFor } from "@/lib/rate-limit";

interface TemplateRow {
  id: string;
  name: string;
  display_name: string;
  icon: string | null;
  description: string | null;
  ai_prompt_context: string | null;
  is_default: boolean;
  created_at?: string;
}

function toTemplate(row: TemplateRow) {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    icon: row.icon || "📝",
    description: row.description || "",
    aiPromptContext: row.ai_prompt_context || undefined,
    isDefault: row.is_default,
    createdAt: row.created_at,
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Built-in defaults are available without an account (landing page template picker)
  if (!user) {
    return NextResponse.json({ templates: DEFAULT_TEMPLATES, source: "builtin" });
  }

  const { data, error } = await supabase
    .from("meeting_templates")
    .select("id, name, display_name, icon, description, ai_prompt_context, is_default, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("meeting_templates query failed:", error.message);
    return NextResponse.json({ templates: DEFAULT_TEMPLATES, source: "builtin" });
  }

  return NextResponse.json({ templates: (data || []).map(toTemplate), source: "database" });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const budget = limitFor(user.id, "agenda");
  if (!budget.ok) {
    return NextResponse.json(
      { error: "Template limit reached. Try again later." },
      { status: 429, headers: { "Retry-After": String(budget.retryAfter) } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const displayName = String(body.displayName || "").trim();
  const description = String(body.description || "").trim();
  const icon = String(body.icon || "📝").slice(0, 4);
  const aiPromptContext = String(body.aiPromptContext || "").trim();

  if (!name) {
    return NextResponse.json({ error: "A template name (slug) is required" }, { status: 400 });
  }
  if (!displayName) {
    return NextResponse.json({ error: "A display name is required" }, { status: 400 });
  }

  // A custom slug must not shadow a built-in, or analysis would silently
  // resolve to the wrong prompt context
  if (DEFAULT_TEMPLATES.some((t) => t.name === name)) {
    return NextResponse.json({ error: `"${name}" is a built-in template name` }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("meeting_templates")
    .insert({
      user_id: user.id,
      name,
      display_name: displayName,
      description: description || null,
      icon,
      ai_prompt_context: aiPromptContext || null,
      is_default: false,
    })
    .select("id, name, display_name, icon, description, ai_prompt_context, is_default, created_at")
    .single();

  if (error) {
    const conflict = error.message.includes("duplicate") || error.code === "23505";
    return NextResponse.json(
      { error: conflict ? `You already have a template called "${displayName}"` : error.message },
      { status: conflict ? 409 : 500 }
    );
  }

  return NextResponse.json(toTemplate(data), { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Scoped by user_id so one account cannot delete another's template
  const { error } = await supabase
    .from("meeting_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("is_default", false);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
