update private.gestion_price_book
set pricing_mode='fixed',
    price_free=0.08,
    price_pro=0.07,
    price_premium=0.06,
    reference_cost_usd=0.0525,
    benchmark_required=false,
    requires_live_cost_check=true,
    minimum_margin_percent=5,
    notes='Temporary protected HyperFrames/FFmpeg <=10s price. Conservative internal cost ceiling US$0.05 plus 5% operating-error buffer = US$0.0525 reference cost. Customer price is rounded upward by plan and remains subject to live-cost safety gate; benchmark is not a release dependency.',
    pricebook_version='v3',
    updated_at=now()
where service_key='video_exact_10s' and active=true;

update private.gestion_price_book
set pricing_mode='fixed',
    price_free=0.16,
    price_pro=0.14,
    price_premium=0.12,
    reference_cost_usd=0.105,
    benchmark_required=false,
    requires_live_cost_check=true,
    minimum_margin_percent=5,
    notes='Temporary protected MuseTalk <=10s price. Conservative internal cost ceiling US$0.10 plus 5% operating-error buffer = US$0.105 reference cost. Customer price is rounded upward by plan and remains subject to live-cost safety gate; benchmark is not a release dependency.',
    pricebook_version='v3',
    updated_at=now()
where service_key='video_lipsync_10s' and active=true;

update private.gestion_price_book
set pricing_mode='fixed',
    price_free=0.79,
    price_pro=0.66,
    price_premium=0.60,
    reference_cost_usd=0.525,
    benchmark_required=false,
    requires_live_cost_check=true,
    minimum_margin_percent=5,
    notes='Temporary protected EchoMimicV2 <=10s price. Conservative internal cost ceiling US$0.50 plus 5% operating-error buffer = US$0.525 reference cost. Customer price is rounded upward by plan and remains subject to live-cost safety gate; benchmark is not a release dependency.',
    pricebook_version='v3',
    updated_at=now()
where service_key='video_avatar_photo_10s' and active=true;
