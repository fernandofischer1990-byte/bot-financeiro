-- Add UPDATE and DELETE policies for chat_messages table
-- Users should only be able to update/delete their own messages

CREATE POLICY "Users can update own chat messages"
ON public.chat_messages
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat messages"
ON public.chat_messages
FOR DELETE
USING (auth.uid() = user_id);