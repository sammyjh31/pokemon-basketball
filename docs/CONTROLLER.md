# Arcade controller support

Exhibitions and official franchise/playoff games accept one browser-standard gamepad, including Xbox controllers when the operating system and browser recognize them. Connect over USB or pair in the operating system, open the game in a browser, enter the arcade, then press a controller button and release it. The arcade displays its connection status. HTTPS or localhost is required by browsers that restrict the Gamepad API.

| Xbox control | Action |
| --- | --- |
| Left stick or D-pad | Move; stick dead zone prevents drift |
| X, held then released | Shoot/dunk; jump/block on defense |
| A | Pass; steal on defense |
| B | Select receiver; switch defender |
| RT | Turbo |
| Menu | Pause; resume/continue a paused period |
| Stick/D-pad in menus | Move focus; left/right changes a selected dropdown |
| A in menus | Activate the focused choice; defaults to the primary action |
| B in a dialog | Go back/close the current dialog |

Keyboard and touch remain usable. A controller must return to neutral after connecting, changing gameplay screens, pausing or losing focus, so a held button cannot accidentally shoot after resuming. Unplugging the active pad cancels any charged shot and pauses play. Another connected controller cannot steal control while the active one remains connected. Only standard mappings are accepted; an unfamiliar raw mapping produces a useful status message instead of guessing controls.

The first version supports one controller controlling the user's team. It does not add multiplayer, rumble or remapping. Initial franchise/draft selection is still the main application's mouse/keyboard interface; controller menu navigation starts inside the arcade. No controller data is saved to a franchise or sent anywhere.

Validation uses gamepad-shaped samples with the real input controller and arcade runtime: button edges, held shooting/release, stick normalization/dead zone, D-pad, mixed keyboard input, Menu pause/resume, neutral rearming, disconnect cancellation, menu selection and unavailable APIs. Physical Xbox hardware has not been tested in this environment; exact device/OS/browser support still requires a real connection check. Chrome or Edge is a useful fallback if an embedded browser cannot expose a controller.

API reference: [MDN Gamepad API guide](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API).
