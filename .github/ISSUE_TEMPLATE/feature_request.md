name: "✨ Feature Request"
description: "Suggest an idea to improve Texture Ripper"

body:
  - type: markdown
    attributes:
      value: |
        Thanks for suggesting an improvement!  
        Please fill out the sections below to help us understand your idea better.  
        - Keep one idea per request.

  - type: textarea
    attributes:
      label: "Is your feature request related to a problem?"
      description: "Describe the problem you’re facing. Example: 'I'm always frustrated when…'"
      placeholder: "It's not possible to copy a single texture and use it in another program."
    validations:
      required: true

  - type: textarea
    attributes:
      label: "Describe the solution you’d like"
      description: "What do you want to happen?"
      placeholder: "Add a 'copy' button to copy the selected texture to clipboard."
    validations:
      required: true

  - type: textarea
    attributes:
      label: "Describe alternatives you’ve considered"
      description: "What other solutions or workarounds have you thought about?"
      placeholder: "Exporting each texture separately."

  - type: textarea
    attributes:
      label: "Additional context"
      description: "Add any other context, references, or screenshots about the feature request."