import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || "https://lnycmvscjimmdritmoul.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxueWNtdnNjamltbWRyaXRtb3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMDMzMzAsImV4cCI6MjEwMDU3OTMzMH0.FDxriw9LT9NOkXnvvOtvACMHV000owMCENBOqk8ydDo";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const users = [
  { email: 'email1@gmail.com', password: 'email1' },
  { email: 'email2@gmail.com', password: 'email2' },
  { email: 'email3@gmail.com', password: 'email3' },
];

async function createUsers() {
  console.log("Starting user creation...");
  for (const user of users) {
    const { data, error } = await supabase.auth.signUp({
      email: user.email,
      password: user.password,
    });
    
    if (error) {
      console.error(`Error creating ${user.email}:`, error.message);
    } else {
      console.log(`Success creating ${user.email}:`, data.user?.id);
    }
  }
}

createUsers();
