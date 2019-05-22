export const accounts = async (req, res) => {
  const user: User = req.user;
  const accounts = await Promise.all(
    user.accounts.map(
      async ({ profile: { username, id }, total, expired }) => ({
        id,
        username,
        expired,
        total,
      })
    )
  );
  return res.status(200).json({ accounts, lists: user.lists });
};
