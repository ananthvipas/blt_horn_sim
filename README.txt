BLT MD DEVICE — MELODY FILE READER

No USB, serial port, Wi-Fi, or ESP32 connection is needed. Choose a .c, .h, .cpp, .ino, .hpp, or .txt file containing C/C++ arrays, for example:
MelodyStep melody1[] = { {H2, 180}, {0, 70}, {H4, 220} };

The app lists detected arrays as Melody 1, Melody 2, etc. Select one and use Play, Pause, Stop, or Restart. Playback speed and volume are adjustable.

Browser test tones are provisional: H1 300 Hz, H2 350 Hz, H3 400 Hz, H4 450 Hz, H5 500 Hz, H6 550 Hz. These are not measured acoustic specifications of the physical horns. Numeric 0 means silence. The reader plays tones in the browser and does not activate physical hardware.

HORN hold-to-play: Select a melody, then press and hold the green HORN button to play the full melody continuously. Releasing the button stops playback immediately. Works with mouse, touch, and keyboard (Space/Enter).

Desktop UI layout: compact single-viewport workspace. Playback controls and current step are grouped on the left, horn testing and frequency configuration are grouped on the right, with the melody sequence and file library using their own scroll areas when needed.

Melody parser update: supports simultaneous horn expressions such as {H1 | H2, 250}, single horns, silence {0, duration}, and unsigned duration suffixes. Simultaneous horns play together using each horn's configured frequency. Playback speed slider range is now 0.25x to 6x.

Mobile optimization: responsive single-column layout, touch-friendly HORN buttons and sliders, compact melody library, two-column frequency controls, and independently scrollable melody steps. Horizontal overflow is suppressed on small screens.

Auto-scroll behavior: playback highlights the active sequence step without automatically scrolling the page or sequence panel. The current viewport stays where the user left it on desktop and mobile.
