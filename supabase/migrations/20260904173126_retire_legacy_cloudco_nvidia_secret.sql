-- LISTIA AI Engine owns provider credentials. Retire the unused legacy gateway token.
delete from vault.secrets where name='listia_cloudco_nvidia_gateway_token';
