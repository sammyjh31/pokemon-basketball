# Rebounds, transition and shot creation

Add optional possessionVersion: 1 to frozen simulation inputs. New standard seasons and new local leagues enable it; absent flags preserve old deterministic games. Existing standard franchises upgrade only when starting their next season. Existing local careers retain their original rules.

Rebounds use individual pursuit and box-out strength, fatigue, shot location, and coaching commitment. Interior teams crash harder but surrender better transition opportunities; pace/defense teams send more players back. Long misses favor movement more than strength. Select actual rebounders from their contribution weights. A defensive rebound can trigger an outlet-driven fast break; a stolen live ball gives a stronger advantage, while dead-ball turnovers do not. Advantages expire at period boundaries. Offensive rebounds retain possession, enable putbacks or kick-outs, and are counted as second chances.

Before shot resolution, resolve whether a pass created the shot. Record potential assists independently of makes, credit an assist on a made created shot, track the field-goal points created and expected points created. Screens can create made baskets for others. Report rebound chances and box-outs, offensive/defensive boards, transition/second-chance/clutch scoring and points off turnovers. Statistical categories can overlap and must be labeled. Track actual events, including free throws, without consuming telemetry RNG or changing accounting.

Expose per-game and season insight tables with sample sizes and explicit missing-detail treatment. Save only frozen inputs, reconstruct detail on demand. Do not add injuries, aging, evolution, retirement or draft-pick trades. Coefficients are bounded game design choices.

Verify old byte digests; replay/collection equivalence; eight-player/five-on-floor and scoring conservation; offensive rebounds versus retained possession; assists versus created shots; ownership and no self-assists; turnover origins; period resets; standard/local persistence and archive rules; aggregate statistics; seeded balance and desktop/mobile UI.
