import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotificationRequest {
  meetingId: string;
  meetingTitle: string;
  summary: string;
  transcriptUrl?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { meetingId, meetingTitle, summary, transcriptUrl }: NotificationRequest = await req.json();

    const { data: attendees, error: attendeesError } = await supabase
      .from("attendees")
      .select("*")
      .eq("meeting_id", meetingId)
      .eq("notification_sent", false);

    if (attendeesError) {
      throw new Error(`Failed to fetch attendees: ${attendeesError.message}`);
    }

    if (!attendees || attendees.length === 0) {
      return new Response(
        JSON.stringify({ message: "No attendees to notify" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const notifications = attendees.map(async (attendee) => {
      const emailContent = {
        to: attendee.email,
        subject: `Meeting Notes: ${meetingTitle}`,
        html: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2 style="color: #2563eb;">Meeting: ${meetingTitle}</h2>
              <p>Dear ${attendee.name},</p>
              <p>Thank you for attending the meeting. Here's a summary of what was discussed:</p>
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Summary</h3>
                <p>${summary}</p>
              </div>
              ${transcriptUrl ? `<p><a href="${transcriptUrl}" style="color: #2563eb;">View full transcript</a></p>` : ""}
              <p>Best regards,<br/>Meeting Recorder Team</p>
            </body>
          </html>
        `,
      };

      console.log(`Notification prepared for ${attendee.email}:`, emailContent.subject);

      await supabase
        .from("attendees")
        .update({ notification_sent: true })
        .eq("id", attendee.id);

      return emailContent;
    });

    await Promise.all(notifications);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notifications sent to ${attendees.length} attendees`,
        count: attendees.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending notifications:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});