revoke insert, update, delete
on table public.parser_analysis_credit_reservations
from authenticated;

revoke select, insert, update, delete
on table public.parser_analysis_credit_reservations
from anon;

revoke insert, update, delete
on table public.parser_analysis_credit_reservations
from public;
