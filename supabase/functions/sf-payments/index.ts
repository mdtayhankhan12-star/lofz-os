// LOFZ OS — Steadfast Payment (Paid টাকা) সব পাতা ধরে অ্যাপে আনে। Supabase-এ deploy করা v3 এর সোর্স।
// সংক্ষেপ: GET /payments?page=N লুপ → sf_payments টেবিলে upsert (সময় +06:00)। Owner JWT বা x-cron-key লাগে।
