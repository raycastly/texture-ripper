name: "🐛 Bug Report"
description: "Report a bug in Texture Ripper"

body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to report a bug!  
        Please fill out the sections below as completely as possible.  
        - **One issue per bug** (don’t combine multiple bugs).  
        - Before submitting, check existing [open](https://github.com/raycastly/texture-ripper/issues) and [closed](https://github.com/raycastly/texture-ripper/issues?q=is%3Aissue+is%3Aclosed) issues.

  - type: textarea
    attributes:
      label: "Describe the bug"
      description: "A clear and concise description of what the bug is."
      placeholder: "Example: The tool crashes when exporting textures with transparency."
    validations:
      required: true

  - type: textarea
    attributes:
      label: "Steps to reproduce"
      description: "Provide a step-by-step list of how to reproduce the issue."
      placeholder: |
        1. Go to '...'
        2. Click on '...'
        3. Scroll down to '...'
        4. See error
    validations:
      required: true

  - type: textarea
    attributes:
      label: "Expected behavior"
      description: "What did you expect to happen instead?"
      placeholder: "Example: The export should complete without crashing."

  - type: textarea
    attributes:
      label: "Screenshots"
      description: "If applicable, drag and drop screenshots to help explain your problem."
      placeholder: "You can also paste images directly here."

  - type: input
    attributes:
      label: "System information"
      description: "Your system details (OS, browser, app version, etc.)"
      placeholder: "Windows 11 - Brave Browser - Texture Ripper v1.2.0"

  - type: textarea
    attributes:
      label: "Console logs / errors"
      description: |
        Please copy and paste any errors or warnings from your browser’s **Developer Console**.  
        (In most browsers, you can open it with F12 → Console tab.)  
        Use triple backticks (```) to format logs as code.
      placeholder: |
        ```
        Uncaught TypeError: Cannot read properties of undefined (reading 'length')
            at main.js:123:45
        ```

  - type: textarea
    attributes:
      label: "Additional context"
      description: "Add any other context about the problem here."
      placeholder: "Example: Only happens when exporting PNGs larger than 2048px."
