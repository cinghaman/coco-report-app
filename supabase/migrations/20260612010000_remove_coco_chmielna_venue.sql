-- Remove closed Coco Chmielna location and detach from user profiles
UPDATE public.users
SET venue_ids = array_remove(venue_ids, '85ff2a93-7c37-464c-81cb-eea4a15e54c4'::uuid)
WHERE '85ff2a93-7c37-464c-81cb-eea4a15e54c4' = ANY (venue_ids);

DELETE FROM public.venues
WHERE id = '85ff2a93-7c37-464c-81cb-eea4a15e54c4';
