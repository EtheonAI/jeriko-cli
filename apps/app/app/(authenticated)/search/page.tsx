import { auth } from "@repo/auth/server";
import { redirect } from "next/navigation";
import { Header } from "../components/header";
import { headers } from "next/headers";
import { SearchResultsClient } from "./search-results-client";

type SearchPageProperties = {
  searchParams: Promise<{
    q?: string;
    type?: string;
  }>;
};

export const generateMetadata = async ({
  searchParams,
}: SearchPageProperties) => {
  const { q } = await searchParams;

  return {
    title: q ? `${q} - Search results` : "Search",
    description: q ? `Search results for ${q}` : "Search across all your content",
  };
};

const SearchPage = async ({ searchParams }: SearchPageProperties) => {
  const { q, type } = await searchParams;
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <>
      <Header page="Search" pages={["Search"]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <SearchResultsClient initialQuery={q} initialType={type} />
      </div>
    </>
  );
};

export default SearchPage;
