const ADMIN_USER = "admin";
const ADMIN_PASS = "change_me";
const ENDPOINT = "http://localhost:8000";

const EDITIONS = [
    {
        id: 2,
        name: "The One That Got Away",
        description:
            "You are encouraged to get creative with the theme. Write about the Katy Perry song, a cricket ball that ended a match, a lost career opportunity... Anything, or anyone, that slipped through your fingers.",
    },
    {
        id: 3,
        name: "tell a tale of time travel",
        description:
            "This is not a format restriction - you can still submit poem, short story, play. You are encouraged to get creative with the theme. Write about mad scientists, a nostalgia trip to one's own past, a bureaucrat processing visas, a wizard in another realm hurtling into the future... or something else entirely. All of time is yours for the taking.",
    },
    {
        id: 4,
        name: "Flavours of Love",
        description:
            "You are encouraged to get creative with the theme. Talk about food, or the types of love you've experienced, or family drama... give your reader a taste of what love is like.",
    },
    {
        id: 5,
        name: "Two Stories",
        description:
            "You are encouraged to get creative with the theme. Write a poem that reads differently top to bottom and bottom to top, two separate stories side-by-side, a reflection the House M.D. episode, or tell the same events from two different perspectives.",
    },
    {
        id: 6,
        name: "An object in my room",
        description:
            "You are encouraged to get creative with the theme. Write about your favourite t-shirt, a special sea-shell from the beach, a portrait of someone near and dear, or something else entirely. There is lots to find when you know how to look.",
    },
    {
        id: 7,
        name: "You Can Never Go Home",
        description:
            'You are encouraged to get creative with the theme. Write about lost childhoods, a nightmare clown\'s basement prison, moving to a different country, or something else entirely. In the words of Gregory David Roberts:\n\n> "It’s said that you can never go home again, and it’s true enough, of course. But the opposite is also true. You must go back, and you always go back, and you can never stop going back, no matter how hard you try."',
    },
    {
        id: 8,
        name: "A World on Fire",
        description:
            "You are encouraged to get creative with the theme. Write about global warming, events that would set your personal life ablaze, a burning toy globe, or something else entirely. The world is your (flaming) oyster.",
    },
    {
        id: 9,
        name: "Too Much and Never Enough",
        description:
            "You are encouraged to get creative with the theme. Write about failed relationships, the woodcutter and his axes, personal ambitions, capitalist greed, or simply that hollow feeling we all get sometimes.",
    },
    {
        id: 10,
        name: "Memories in Transit",
        description:
            "You are encouraged to get creative with the theme. Reminisce about a childhood vacation, write about a family photo album, tell us about your time riding public transport, or try something else entirely. After all, what is life but a series of memories in transit?",
    },
    {
        id: 11,
        name: "The horrors persist, but so do I",
        description:
            "You are encouraged to get creative with the theme. Write about the humble lotus drawing its life from the mud that surrounds it. Write about staying silly at your dreary corporate job. Write about the indomitable human spirit charging on through the worst life has to offer. We'd love to hear your tales of persistence.",
    },
    {
        id: 12,
        name: "What We Are, Have Been, and Always Will Be",
        description:
            "You are encouraged to get creative with the theme. Write about the grand, the cosmic, or the mundane. A mother and her child or small talk in the town square. Love across the ages, this blue marble we  live on, or something else entirely. What does it really mean to be us ?",
    },
    {
        id: 13,
        name: "Me and You and Everyone We Know",
        description:
            "You are encouraged to get creative with the theme. Write about the webs we weave of each other, being together at the end of the world, Bacon numbers, or something else entirely. What more is there to life than the people that surround us?",
    },
    {
        id: 14,
        name: "i love you",
        description:
            "You are encouraged to get creative with the theme. Interpret it however you like—it could be the first line of your piece, a fictional exploration, a dialogue within your work, an essay on the phrase itself, anything at all.",
    },
    {
        id: 15,
        name: "Telephone Dreams",
        description:
            "You are encouraged to get creative with the theme. Talk about long-distance friendships, the invention of telephony, the dreams of a handset, or something else entirely. Do telephones dream of electric sheep?",
    },
    {
        id: 16,
        name: "Diwali",
        description:
            "You are encouraged to get creative with the theme. Talk about the relief away from work or the dread of visiting parents. How everything feels so different; whether the lit lamp feels dimmer these days. Do the firecrackers seem as bright when you're an adult?",
    },
    {
        id: 17,
        name: "A Temple to Your Memory",
        description:
            "A bit topical given the recent news :P You are encouraged to get creative with the theme. Write about lost loves, Writers Jam, the Taj Mahal, Sonnet Fifty-Five, or something else entirely. What temples live in your memory?",
    },
];

// Helper for fuzzy string comparison
function normalize(str: string) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseArgs() {
    const args = Deno.args;
    let skip = 0;
    for (const arg of args) {
        if (arg.startsWith("--skip=")) {
            skip = parseInt(arg.split("=")[1], 10);
        }
    }
    return { skip };
}

async function main() {
    const { skip } = parseArgs();
    console.log("Authenticating...");
    const authRes = await fetch(`${ENDPOINT}/api/v1/admin/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
    });

    if (!authRes.ok) {
        console.error("Authentication failed:", await authRes.text());
        Deno.exit(1);
    }

    const { token } = await authRes.json();
    console.log("Authenticated successfully.\n");

    for (const { id, name, description } of EDITIONS) {
        if (id < skip) {
            console.log(`Skipping edition ${id} (due to --skip=${skip})`);
            continue;
        }

        // 1. Fetch current edition details to verify name
        const getRes = await fetch(`${ENDPOINT}/api/v1/editions/${id}`);
        if (!getRes.ok) {
            console.warn(`[WARN] Could not fetch edition ${id}. Skipping. (${getRes.status})`);
            continue;
        }

        const { data: edition } = await getRes.json();

        // 2. Verify name
        // We use a loose check: if one contains the other (normalized)
        const localNorm = normalize(name);
        const remoteNorm = normalize(edition.name);

        if (!remoteNorm.includes(localNorm) && !localNorm.includes(remoteNorm)) {
            console.error(`[ERROR] Edition ${id} name mismatch!`);
            console.error(`  Expected (or similar to): "${name}"`);
            console.error(`  Found on server:        "${edition.name}"`);
            console.error("  Skipping update for this edition.\n");
            continue;
        }

        console.log(`\n--- Edition ${id}: ${edition.name} ---`);
        console.log(`Current Description:\n${edition.description || "(none)"}`);
        console.log(`\nNew Description:\n${description}`);
        console.log("-----------------------------------");

        const confirm = prompt("Update this edition? [y/N]:");
        if (confirm?.toLowerCase() !== "y") {
            console.log("Skipping update.");
            continue;
        }

        // 3. Update description
        const updateRes = await fetch(`${ENDPOINT}/api/v1/admin/editions/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ description }),
        });

        if (updateRes.ok) {
            console.log(`✅ Edition ${id} updated successfully.`);
        } else {
            console.error(`❌ Failed to update edition ${id}:`, await updateRes.text());
        }
    }

    console.log("Done.");
}
if (import.meta.main) {
    main();
}
