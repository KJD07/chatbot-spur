import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const conversation = await prisma.conversation.create({
    data: {
      messages: {
        create: [
          {
            sender: "USER",
            text: "Do you ship to the USA?",
          },
          {
            sender: "AI",
            text: "Yes! We ship worldwide. Delivery to the USA takes 5–7 days. Orders above $50 get free shipping.",
          },
        ],
      },
    },
    include: { messages: true },
  });

  console.log("Seeded conversation:", conversation.id);
  console.log("Messages:", conversation.messages.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
