import { HttpStatusCode } from "axios";

export async function getRepoInfo(packageName = "", packageVersion = "") {
    const npmPackageInfo = await fetch(
        `https://registry.npmjs.org/${packageName}/${packageVersion}`,
    );
    const {
        repository,
    }: { repository: { type: string; url: string; directory: string } } =
        await npmPackageInfo.json();
    const [protocol, domain, userName, repo] = repository.url
        .replace(/\/\//, "/")
        .split("/");
    const repoName = repo.replace(/(\.git)$/, "");
    if (npmPackageInfo.status === HttpStatusCode.Ok) return {
        userName,
        repoName,
        protocol,
        domain,
        ...repository,
    };
    return null;

}

export async function getTagsData(userName = "", repoName = "") {
    const tagsData = await fetch(
        `https://api.github.com/repos/${userName}/${repoName}/git/matching-refs/tags`,
    );
    const allTags: {
        ref: string;
        node_id: string;
        url: string;
        object: { sha: string; type: string; url: string };
    }[] = await tagsData.json();
    if (tagsData.status === HttpStatusCode.Ok) return allTags;
    return [];
}