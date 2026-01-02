import * as cf from "@campfire/core";
import { r } from "@campfire/core";
import { parseMd } from "./parse.js";
import { showDialog } from "./dialog.js";

const TutorialPane = (description, content) => {
    const [wrapper] = cf.nu("div.tutorial-pane")
        .html`
        <div class='tutorial-description'>${r(parseMd(description))}</div>
        <div class=tutorial-text>${r(content)}</div>
        <div class=content-rendered>${r(parseMd(content))}</div>`
        .done();

    return wrapper;
};

const PaneSwitcher = (panes, ondone) => {
    const current = cf.store({ value: 0 });
    const [elt] = cf.nu("div")
        .html`<cf-slot name='panes'></cf-slot>`
        .children({ panes })
        .done();
    const hide = () => panes.forEach((pane) => pane.style.display = "none");
    let done = false;
    current.on("update", ({ value }) => {
        if (value >= panes.length) {
            if (done) return;
            ondone();
            done = true;
        } else {
            hide();
            panes[value].style.display = "grid";
        }
    });
    hide();
    panes[0].style.display = "grid";
    return { switcher: elt, currentPane: current };
};

const BASIC_FORMATTING = `
Basic formatting is the same as you might be familiar with. **bold**, _italic_, ~~strikethrough~~
all work as expected.
`.trim();

const HEADINGS = `
# Heading 1
## Heading 2
### Heading 3
`.trim();

const LISTS = `
* Bulleted list item 1
* Bulleted list item 2
* Bulleted list item 3
`.trim();

const POEMS = `
If you write a line then press &lt;**Enter**&gt;
then type something else, they appear on the same line!
To make a paragraph break, you can leave a blank line -- 
but how do you make a break in a line that doesn't 
indicate a new paragraph?

To make a soft break,<span class='visible-space'> </span><span class='visible-space'> </span>  
**you must** end each line<span class='visible-space'> </span><span class='visible-space'> </span>  
with two spaces<span class='visible-space'> </span><span class='visible-space'> </span>  

This way you can<span class='visible-space'> </span><span class='visible-space'> </span>  
group lines in stanzas<span class='visible-space'> </span><span class='visible-space'> </span>  
in your work.
`.trim();

const QUOTES = `
Simply prefix each line with a \`>\`. All other rules of
formatting are available here!

> "The story so far: In the beginning the Universe was created.
> This has made a lot of people very angry and been widely regarded as a bad move."
>
> -- *Douglas Adams, The Restaurant at the End of the Universe*.
`.trim();

const MISC = `
To make an en dash, type "--". 

----

To make an em dash, type "---".

----

To make a line to separate chapters, sections, etc in your work,
type a line with atleast four dashes in it at the start, and
make sure it has a blank line before it:

----

Enjoy writing!
`.trim();

const TUTORIAL_PANES = [
    TutorialPane(
        `Hi! Welcome to the Writers Jam tutorial. 
        On the left you will see text as you might enter into the Writers 
        Jam editor, and on the right you will see text as it will 
        be displayed when you complete your post.`,
        BASIC_FORMATTING,
    ),
    TutorialPane("Here's how to make a heading/sub-heading in your post.", HEADINGS),
    TutorialPane("Here's how to add a list to your post.", LISTS),
    TutorialPane(
        `Now, **if you write poetry**, look closely.
        '<span class='visible-space'> </span>' denotes pressing Space once.
    `,
        POEMS,
    ),
    TutorialPane("To add a block quote to your work:", QUOTES),
    TutorialPane(
        `We\'re done! You can visit this tutorial
        anytime by clicking the Help icon on the edit page. Some miscellaneous tips
        if you want to get even fancier:`,
        MISC,
    ),
];

export const initTutorial = async () => {
    const dialog = document.querySelector("dialog");
    const { switcher, currentPane } = PaneSwitcher(TUTORIAL_PANES, () => {
        dialog.close();
    });

    const [tutorial, prevBtn, nextBtn] = cf.nu("div.tutorial")
        .html`
            <cf-slot name=switcher></cf-slot>
            <div class='form-group paginate-group'>
                <button id='tutorial-prev'>Back</button>
                <button id='tutorial-next'>Next</button>
            </div>
        `
        .gimme("#tutorial-prev", "#tutorial-next")
        .children({ switcher })
        .done();

    const updateBtns = () => {
        const current = currentPane.current();
        prevBtn.style.display = current === 0 ? "none" : "inline";
        nextBtn.innerHTML = current >= TUTORIAL_PANES.length - 1 ? "Done" : "Next";
    };

    nextBtn.onclick = () => {
        currentPane.update((current) => current + 1);
        updateBtns();
    };

    prevBtn.style.display = "none";

    prevBtn.onclick = () => {
        currentPane.update((current) => current - 1 < 0 ? current : current - 1);
        updateBtns();
    };

    await showDialog(tutorial);
};
