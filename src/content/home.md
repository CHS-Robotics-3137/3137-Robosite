<!--
home.md — Homepage editing guide

Sections appear on the website in the same order as this document.
The hero, navigation, and footer are managed separately.

TEXT PANELS
- Start each panel with a ## heading.
- Write its content below that heading.
- Use ### through ###### for smaller headings inside the panel.
- Separate paragraphs with a blank line.
- Move or delete an entire panel to move or remove it.

FORMATTING
- **bold** and *italic*
- [link text](https://example.com)
- Lines starting with "- " create bullet lists.
- Lines starting with "1. " create numbered lists.
- Lines starting with "> " create quotations.
- A standalone --- creates a dividing line INSIDE a panel.

PHOTO WINDOWS
Use a standalone instruction like this, with blank lines around it:

::photo{src="robots/2025-robot/robo-on-field-1.png" position="center 60%"}

- Photo paths start inside src/assets/images.
- Upload new photos there, then reference their exact path and capitalization.
- These windows are decorative, not a place for essential information.
- The position setting adjusts the crop; it does not resize the window.
- After a photo, start a new ## heading before adding more text.
- Ordinary Markdown images are NOT photo windows and do not currently
  receive the photo-window image optimization.

PUBLISHING
- Save and preview locally.
- Run npm run build to check for build errors.
- Commit and push to publish through GitHub Actions.
-->

## About our team

Connetquot Robotics, Team 3137, is our school's FIRST Robotics Competition team.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris hendrerit, dui a dapibus imperdiet, lectus ex efficitur odio, non luctus velit justo ac enim. Proin a luctus lectus, ut euismod eros. Donec iaculis volutpat ante, ut fermentum elit porttitor vitae. Aliquam vitae nunc ornare, fringilla purus eget, fringilla ex. In sed lacus condimentum, sodales felis sit amet, sodales turpis. Nam a ullamcorper leo. Nulla congue orci commodo eleifend mattis. Cras sagittis magna lacus, quis feugiat magna hendrerit ac. Phasellus lorem ex, convallis id neque vitae, tristique laoreet enim. Nulla elementum congue nunc vel iaculis. Vivamus suscipit nisl ac semper dignissim. Phasellus imperdiet vulputate metus, non dapibus eros feugiat vel. Quisque lobortis malesuada tempor. Praesent porttitor consequat risus.

::photo{src="robots/2025-robot/robo-on-field-1.png" position="center 60%"}

## Lorem ipsum

This is placeholder text for the second panel.

### A smaller heading inside this panel

Markdown supports **bold**, *italics*, and [links](https://www.firstinspires.org/).

- A first list item.
- A second list item.

> A sample quotation inside the panel.

---

A paragraph after a horizontal dividing line.

::photo{src="robots/2024-robot/robot-in-pit.png" position="center 10%"}

## Lorem ipsum dolor

This is placeholder text for the third panel.

::photo{src="robots/2024-robot/robot-in-pit.png" position="center 10%"}

## Testing a new section

This panel was added by editing only the Markdown file.