CREATE POLICY "Users can delete own mappings"
ON public.category_mappings
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);