import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://snyqrwtsqbkvgxomsubl.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNueXFyd3RzcWJrdmd4b21zdWJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjMyNjUxMSwiZXhwIjoyMDkxOTAyNTExfQ.ur7eVnWJ4Bsw6at1-yroIt7Zc4fmQqh7spMQs1rvbkY'

export const supabase = createClient(supabaseUrl, supabaseKey)