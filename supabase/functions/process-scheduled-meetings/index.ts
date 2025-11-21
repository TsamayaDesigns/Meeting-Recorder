import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ScheduledMeeting {
  id: string;
  user_id: string;
  provider: string;
  provider_meeting_id: string;
  title: string;
  scheduled_start: string;
  scheduled_end: string;
  meeting_link: string;
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

    const now = new Date();
    const startWindow = new Date(now.getTime() - 5 * 60000);
    const endWindow = new Date(now.getTime() + 5 * 60000);

    const { data: meetings, error: meetingsError } = await supabase
      .from("scheduled_meetings")
      .select("*")
      .eq("recording_status", "pending")
      .gte("scheduled_start", startWindow.toISOString())
      .lte("scheduled_start", endWindow.toISOString());

    if (meetingsError) {
      throw new Error(`Failed to fetch meetings: ${meetingsError.message}`);
    }

    if (!meetings || meetings.length === 0) {
      return new Response(
        JSON.stringify({ message: "No meetings to process", count: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const processedMeetings = [];

    for (const meeting of meetings) {
      try {
        await processScheduledMeeting(supabase, meeting);
        processedMeetings.push(meeting.id);
      } catch (error) {
        console.error(`Error processing meeting ${meeting.id}:`, error);

        await supabase
          .from("scheduled_meetings")
          .update({
            recording_status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", meeting.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedMeetings.length} meetings`,
        count: processedMeetings.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in scheduled meetings processor:", error);

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

async function processScheduledMeeting(
  supabase: any,
  meeting: ScheduledMeeting
): Promise<void> {
  await supabase
    .from("scheduled_meetings")
    .update({
      recording_status: "recording",
      updated_at: new Date().toISOString(),
    })
    .eq("id", meeting.id);

  const internalMeetingData = {
    title: meeting.title,
    description: `Recorded from ${meeting.provider}`,
    start_time: meeting.scheduled_start,
    end_time: meeting.scheduled_end,
    status: "recording",
    created_by: meeting.user_id,
    recording_url: meeting.meeting_link,
  };

  const { data: internalMeeting, error: insertError } = await supabase
    .from("meetings")
    .insert(internalMeetingData)
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to create internal meeting: ${insertError.message}`);
  }

  await supabase
    .from("scheduled_meetings")
    .update({
      internal_meeting_id: internalMeeting.id,
    })
    .eq("id", meeting.id);
}

export const config = {
  functions: {
    "process-scheduled-meetings": {
      schedule: "*/5 * * * *",
    },
  },
};
