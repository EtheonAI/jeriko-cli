import { auth } from "@repo/auth/server";
import { notFound, redirect } from "next/navigation";
import { Header } from "../components/header";
import { headers } from "next/headers";

type SearchPageProperties = {
  searchParams: Promise<{
    q: string;
  }>;
};

export const generateMetadata = async ({
  searchParams,
}: SearchPageProperties) => {
  const { q } = await searchParams;

  return {
    title: `${q} - Search results`,
    description: `Search results for ${q}`,
  };
};

const SearchPage = async ({ searchParams }: SearchPageProperties) => {
  const { q } = await searchParams;
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  if (!session?.user) {
    redirect("/login");
  }

  if (!q) {
    redirect("/");
  }

  // TODO: Implement search functionality with Drizzle
  const results: { id: string; name: string }[] = [];

  return (
    <>
      <Header page="Search" pages={["Building Your Application"]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">
            Search results for &quot;{q}&quot;
          </h2>
        </div>
        {results.length > 0 ? (
          <div className="grid auto-rows-min gap-4 md:grid-cols-3">
            {results.map((item) => (
              <div
                className="aspect-video rounded-xl bg-muted/50 p-4"
                key={item.id}
              >
                {item.name}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-xl bg-muted/50 p-8">
            <p className="text-muted-foreground">No results found</p>
          </div>
        )}
      </div>
    </>
  );
};

export default SearchPage;
